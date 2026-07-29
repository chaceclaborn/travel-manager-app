/**
 * Native (Capacitor / iOS) global fetch interceptor.
 *
 * WHY THIS EXISTS
 * ---------------
 * The iOS app is a Capacitor shell that loads the Next.js static export from
 * `capacitor://localhost` (server.url is intentionally NOT set — Apple flags
 * remote-webview wrappers under Guideline 4.2). All the app's data fetches use
 * RELATIVE URLs like `fetch('/api/trips')`. Inside the native webview those
 * resolve against the document origin to `capacitor://localhost/api/trips` —
 * where no server exists — so every data call fails.
 *
 * This module installs a single global `window.fetch` wrapper, NATIVE ONLY,
 * that rewrites those relative `/api/*` requests to the production origin
 * (https://travels-manager.com) and attaches the stored Bearer token. Every
 * other request — absolute cross-origin URLs (Supabase auth, map tiles,
 * geocoders) and same-origin non-`/api` paths (static assets, `_next/*`) —
 * passes through the ORIGINAL browser `fetch` completely untouched.
 *
 * HOW CORS IS HANDLED (and why the third-party regression is avoided)
 * -------------------------------------------------------------------
 * A bare cross-origin browser fetch from `capacitor://localhost` to
 * https://travels-manager.com would be blocked by WKWebView CORS AND rejected
 * by the server's Origin-based CSRF check in src/proxy.ts. Rather than open the
 * production API up with CORS/preflight (and weaken that CSRF check) we route
 * the rewritten `/api` request through Capacitor's native HTTP plugin
 * (`CapacitorHttp.request`), which performs the request via the native
 * URLSession layer. Native requests are NOT subject to WKWebView CORS and do
 * NOT carry a browser `Origin` header, so the server's CSRF Origin check treats
 * them like a normal server-to-server call and the Bearer token authenticates
 * them. No server-side CORS, no OPTIONS preflight, and no CSRF changes needed.
 *
 * IMPORTANT: `plugins.CapacitorHttp.enabled = true` IS set in
 * capacitor.config.ts and is REQUIRED — without it, `CapacitorHttp.request()`
 * never resolves on iOS and the app hangs on loading skeletons (this was one
 * of the six native data-layer bugs fixed in PR #11; see the comment in
 * capacitor.config.ts). The flag also makes the Capacitor bridge auto-patch
 * `window.fetch`/`XMLHttpRequest` for cross-origin traffic, which reroutes
 * Supabase login/token-refresh, geocoders, and map tiles through the native
 * URLSession layer — verified working in that configuration. On top of that
 * auto-patch, this module still rewrites relative `/api` URLs to the
 * production origin and attaches the Bearer token, which the auto-patch alone
 * would not do. Do NOT turn the flag off "for safety": that regresses every
 * native data load.
 *
 * ORDERING
 * --------
 * This is installed at MODULE-EVALUATION scope from src/app/(app)/layout.tsx —
 * NOT inside a useEffect — so the patch lands before the layout renders, before
 * any child component renders, and before any effect (including the layout's own
 * is-admin/visit fetches) runs. React effects fire child-first, so a
 * useEffect-based install would lose the race against child fetches.
 *
 * WEB
 * ---
 * On the web, `isNativePlatform()` is false, so `installNativeApiFetchPatch()`
 * returns immediately and never touches `window.fetch`. Browser behavior is
 * byte-for-byte unchanged and continues to use same-origin cookie auth. The
 * `@capacitor/core` import is dynamic and only reached on native, so it never
 * loads on the web.
 */

import { isNativePlatform, getStoredToken } from '@/lib/mobile-auth';
import { App } from '@capacitor/app';
// STATIC import (not dynamic): when CapacitorHttp is enabled it patches fetch to
// go through the native layer, and a dynamic import('@capacitor/core') would then
// try to load its webpack chunk via that native fetch — which cannot read
// capacitor://localhost chunk URLs, so the import hangs forever and stalls every
// /api request. Importing it statically bundles it into the main chunk.
import { CapacitorHttp } from '@capacitor/core';

// Production API origin. Relative `/api/*` calls are rewritten to hit this.
// MUST be the canonical www host: the apex `travels-manager.com` 307-redirects
// to `www.travels-manager.com`, and CapacitorHttp (native URLSession) drops the
// Authorization header / stalls across that cross-host redirect, so every /api
// request would hang and the app would sit on loading skeletons forever.
const API_ORIGIN = 'https://www.travels-manager.com';

/**
 * Canonical public web origin. Use this whenever the app builds a URL that
 * leaves the device (share links, emails): inside the Capacitor shell
 * window.location.origin is capacitor://localhost, which is a dead link for
 * any recipient.
 */
export const WEB_ORIGIN = API_ORIGIN;

// "1.0.1 (5) ios" — fetched once from the native App plugin, then cached.
// Null until resolved (or forever on the web, where the header is not sent).
let appVersionHeader: string | null = null;
let appVersionFetched = false;
async function getAppVersionHeader(): Promise<string | null> {
  if (appVersionFetched) return appVersionHeader;
  appVersionFetched = true;
  try {
    const info = await App.getInfo();
    appVersionHeader = `${info.version} (${info.build}) ios`;
  } catch {
    appVersionHeader = null;
  }
  return appVersionHeader;
}

// Minimal local shapes for the @capacitor/core HTTP plugin. We avoid importing
// the real types statically so this module type-checks and tree-shakes cleanly
// on the web, where the plugin is never loaded.
interface NativeHttpResponse {
  data: unknown;
  status: number;
  headers: Record<string, string>;
  url: string;
}
interface NativeHttpRequestOptions {
  url: string;
  method: string;
  headers?: Record<string, string>;
  data?: unknown;
  // 'json' | 'text' | 'formData' | 'file' at runtime; typed loosely because the
  // typed `request()` signature only advertises a subset but the native layer
  // accepts the full set (this mirrors Capacitor's own auto-patch behavior).
  dataType?: string;
  // 'arraybuffer' | 'blob' | 'json' | 'text' | 'document'. Controls how the
  // NATIVE side serialises the response before it crosses the bridge — see
  // fetchApiBinary().
  responseType?: string;
}

// Module-level guard so the patch installs exactly once, even across Fast
// Refresh, double-mounts, or repeated imports. Also prevents recursion: we
// capture the original fetch once and never re-wrap our own wrapper.
let installed = false;

export interface BinaryApiResponse {
  ok: boolean;
  status: number;
  /** Raw bytes. Empty when the request failed. */
  bytes: Uint8Array;
  /** The same bytes base64-encoded — what @capacitor/filesystem wants. */
  base64: string;
  contentType: string;
  /** Parsed from Content-Disposition when the server sent one. */
  fileName: string | null;
}

export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function bytesToBase64(bytes: Uint8Array): string {
  // Chunked to avoid blowing the argument limit on large PDFs.
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

export function fileNameFromDisposition(disposition: string | null | undefined): string | null {
  if (!disposition) return null;
  // filename*=UTF-8''name.pdf wins over filename="name.pdf" per RFC 6266.
  const extended = /filename\*=(?:UTF-8'')?([^;]+)/i.exec(disposition);
  if (extended) {
    try {
      return decodeURIComponent(extended[1].replace(/^"|"$/g, ''));
    } catch {
      /* fall through to the plain form */
    }
  }
  const plain = /filename="?([^";]+)"?/i.exec(disposition);
  return plain ? plain[1] : null;
}

/**
 * Fetch a BINARY response from our own API, on either platform.
 *
 * Why this exists rather than a flag on the global fetch patch: the patch
 * reconstructs a `Response` by handing `nativeResponse.data` — a STRING —
 * straight to the Response constructor. That is correct for JSON and for text
 * (.ics), but the native layer decodes an unknown body as UTF-8 text by
 * default, which mangles every non-text byte in a PDF. The fix is to ask the
 * native side for base64 up front (`responseType: 'blob'` makes iOS return
 * `data.base64EncodedString()`), which only makes sense per-call. Keeping it in
 * a separate function means the ~130 existing fetch call sites keep their exact
 * current behaviour — this file's header documents six prior native data-layer
 * bugs, and a global change here is the highest-risk edit in the codebase.
 *
 * Note JSON is unaffected either way: the iOS handler checks the response
 * Content-Type for application/json BEFORE it looks at responseType, so an
 * error payload still arrives parsed.
 */
export async function fetchApiBinary(path: string): Promise<BinaryApiResponse> {
  const empty = new Uint8Array(0);

  if (!isNativePlatform()) {
    // Web: ordinary same-origin fetch with cookie auth. No patch involved.
    const res = await fetch(path);
    if (!res.ok) {
      return { ok: false, status: res.status, bytes: empty, base64: '', contentType: '', fileName: null };
    }
    const buffer = new Uint8Array(await res.arrayBuffer());
    return {
      ok: true,
      status: res.status,
      bytes: buffer,
      base64: bytesToBase64(buffer),
      contentType: res.headers.get('Content-Type') ?? '',
      fileName: fileNameFromDisposition(res.headers.get('Content-Disposition')),
    };
  }

  const url = API_ORIGIN + path;
  const headers: Record<string, string> = {};
  const token = await getStoredToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const appVersion = await getAppVersionHeader();
  if (appVersion) headers['X-App-Version'] = appVersion;

  const response = (await CapacitorHttp.request({
    url,
    method: 'GET',
    headers,
    responseType: 'blob',
  } as unknown as Parameters<typeof CapacitorHttp.request>[0])) as unknown as NativeHttpResponse;

  const contentType =
    response.headers['Content-Type'] ?? response.headers['content-type'] ?? '';
  const disposition =
    response.headers['Content-Disposition'] ?? response.headers['content-disposition'];

  if (response.status < 200 || response.status >= 300) {
    return { ok: false, status: response.status, bytes: empty, base64: '', contentType, fileName: null };
  }

  // With responseType 'blob' iOS returns base64 — EXCEPT when the response is
  // JSON, which it parses to an object before this branch is reached. A JSON
  // body here means the server returned an error shape, not a file.
  if (typeof response.data !== 'string') {
    return { ok: false, status: response.status, bytes: empty, base64: '', contentType, fileName: null };
  }

  const base64 = response.data;
  return {
    ok: true,
    status: response.status,
    bytes: base64ToBytes(base64),
    base64,
    contentType,
    fileName: fileNameFromDisposition(disposition),
  };
}


/**
 * Base64-encode a Blob/File. CapacitorHttp transfers binary parts as base64
 * across the native bridge. Mirrors the encoding the Capacitor auto-patch uses.
 */
function readFileAsBase64(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // readAsDataURL yields "data:<mime>;base64,<payload>" — keep just the payload.
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Serialize a multipart FormData body into the array-of-entries shape the
 * native bridge expects (files as base64, everything else as strings). Mirrors
 * Capacitor's own `convertFormData`.
 */
async function convertFormData(formData: FormData): Promise<unknown> {
  const entries: Array<Record<string, unknown>> = [];
  for (const [key, value] of formData.entries()) {
    if (value instanceof File) {
      entries.push({
        key,
        value: await readFileAsBase64(value),
        type: 'base64File',
        contentType: value.type,
        fileName: value.name,
      });
    } else {
      entries.push({ key, value, type: 'string' });
    }
  }
  return entries;
}

/**
 * Convert a fetch body into the { data, dataType } pair CapacitorHttp needs.
 * Mutates `headers` for the FormData case (drops Content-Type so the native
 * layer sets the multipart boundary itself — matches the Capacitor auto-patch).
 * Mirrors Capacitor's own `convertBody` for the body shapes this app produces
 * (JSON strings and FormData); other shapes fall back sensibly.
 */
async function convertBody(
  body: BodyInit | null | undefined,
  headers: Headers
): Promise<{ data: unknown; dataType?: string }> {
  if (body == null) return { data: undefined, dataType: undefined };
  if (body instanceof FormData) {
    headers.delete('Content-Type');
    headers.delete('content-type');
    return { data: await convertFormData(body), dataType: 'formData' };
  }
  if (typeof body === 'string') {
    // Matches the auto-patch: a raw string body (our JSON payloads) is sent as
    // dataType 'json'; the native layer forwards it verbatim as the request body.
    return { data: body, dataType: 'json' };
  }
  if (body instanceof URLSearchParams) {
    return { data: body.toString(), dataType: undefined };
  }
  if (body instanceof Blob) {
    return { data: await readFileAsBase64(body), dataType: 'file' };
  }
  if (body instanceof ArrayBuffer) {
    return { data: new TextDecoder().decode(new Uint8Array(body)), dataType: 'json' };
  }
  if (ArrayBuffer.isView(body)) {
    return { data: new TextDecoder().decode(body as ArrayBufferView), dataType: 'json' };
  }
  // Last resort (e.g. ReadableStream — not used by this app): hand it through.
  return { data: body, dataType: 'json' };
}

/**
 * CapacitorHttp.request has no AbortSignal support. To preserve caller
 * semantics (debounced search, page re-fetch guards, unmount cancellation),
 * race the native request against the signal and reject with an AbortError when
 * it fires. The underlying native request still completes in the background,
 * but its result is discarded — which is exactly what callers expect from an
 * aborted fetch.
 */
function raceAbort<T>(promise: Promise<T>, signal?: AbortSignal | null): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) {
    return Promise.reject(new DOMException('The operation was aborted.', 'AbortError'));
  }
  return new Promise<T>((resolve, reject) => {
    const onAbort = () =>
      reject(new DOMException('The operation was aborted.', 'AbortError'));
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener('abort', onAbort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener('abort', onAbort);
        reject(error);
      }
    );
  });
}

/**
 * Install the native-only global fetch interceptor. Idempotent and a pure
 * no-op on web (and during SSR / static-export prerender, where there is no
 * `window`).
 */
export function installNativeApiFetchPatch(): void {
  if (installed) return;
  if (typeof window === 'undefined') return;
  if (!isNativePlatform()) return;
  installed = true;

  // Capture the ORIGINAL browser fetch once. Every non-/api request is
  // delegated straight to this, so third-party transport is byte-for-byte
  // unchanged. We never re-enter our own wrapper.
  const originalFetch = window.fetch.bind(window);

  window.fetch = async function nativeApiFetch(
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> {
    // Derive the raw URL string regardless of input shape (string | URL | Request).
    const rawUrl =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input instanceof Request
            ? input.url
            : String(input);

    // Resolve against the document origin (capacitor://localhost on native) so
    // relative URLs become absolute and we can inspect origin + pathname.
    let resolved: URL;
    try {
      resolved = new URL(rawUrl, window.location.origin);
    } catch {
      // Un-parseable input — leave it entirely alone.
      return originalFetch(input as RequestInfo, init);
    }

    // Decide whether this request targets OUR origin (i.e. was written as a
    // relative URL such as `/api/trips`).
    //
    // We deliberately do NOT compare `resolved.origin === window.location.origin`.
    // `capacitor://` is a non-special scheme, so per the WHATWG URL standard its
    // parsed origin is opaque and serializes to the string "null"
    // (verified: `new URL('/api/x','capacitor://localhost').origin` === 'null'),
    // whereas WebKit reports `window.location.origin` as the tuple
    // "capacitor://localhost". Those two never compare equal, so an origin-based
    // predicate would be ALWAYS false on device and silently no-op the entire
    // fix. Instead we detect a same-origin request from components that parse
    // consistently:
    //   1. A root-relative URL string ("/api/...", but not protocol-relative
    //      "//host/...") — this is how all 132 call sites are written.
    //   2. An already-absolute URL (e.g. a Request whose .url resolved to
    //      capacitor://localhost/api/...) whose protocol+host match ours.
    // `protocol` and `host` are simple parsed components (not the opaque origin),
    // so they match consistently across both computation paths.
    const isRootRelative = rawUrl.startsWith('/') && !rawUrl.startsWith('//');
    const isSameOriginAbsolute =
      resolved.protocol === window.location.protocol &&
      resolved.host === window.location.host;
    const shouldRewrite =
      (isRootRelative || isSameOriginAbsolute) &&
      resolved.pathname.startsWith('/api');

    if (!shouldRewrite) {
      return originalFetch(input as RequestInfo, init);
    }

    // Preserve path + query + hash exactly — many endpoints (weather, distance,
    // road, route, geocode) depend on the query string.
    const target = API_ORIGIN + resolved.pathname + resolved.search + resolved.hash;

    const req = input instanceof Request ? input : null;

    // Method: init wins over a Request's method, defaulting to GET.
    const method = (init?.method ?? req?.method ?? 'GET').toUpperCase();

    // Merge headers: start from the Request's headers, then let init headers
    // extend/override (matches native `fetch(request, init)` semantics).
    const headers = new Headers(req?.headers);
    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }
    if (!headers.has('Authorization')) {
      const token = await getStoredToken();
      if (token) headers.set('Authorization', `Bearer ${token}`);
    }

    // Identify this binary to the API. Lets the server log/act on old-client
    // traffic (version-skew detection) — see /api/app-config.
    const appVersion = await getAppVersionHeader();
    if (appVersion) headers.set('X-App-Version', appVersion);

    const signal = init?.signal ?? req?.signal ?? undefined;

    // Resolve the body. Prefer init.body; otherwise pull it off the Request
    // (clone so the caller could still read it). GET/HEAD never have a body.
    let rawBody: BodyInit | null | undefined = init?.body;
    if (rawBody == null && req && method !== 'GET' && method !== 'HEAD') {
      const contentType = headers.get('Content-Type') ?? '';
      if (contentType.includes('multipart/form-data')) {
        rawBody = await req.clone().formData();
      } else {
        const text = await req.clone().text();
        rawBody = text.length > 0 ? text : undefined;
      }
    }

    const capacitorHttp = CapacitorHttp;

    const requestOptions: NativeHttpRequestOptions = {
      url: target,
      method,
      headers: Object.fromEntries(headers.entries()),
    };
    // Only attach data/dataType when the request actually has a body. Passing
    // `data: undefined` / `dataType: undefined` on a bodyless GET/HEAD stalls the
    // native CapacitorHttp request (it never resolves) — which hung every /api
    // read and left the app on loading skeletons.
    if (rawBody != null) {
      const { data, dataType } = await convertBody(rawBody, headers);
      requestOptions.data = data;
      requestOptions.dataType = dataType;
    }

    const nativeRequest = capacitorHttp.request(
      requestOptions as unknown as Parameters<typeof capacitorHttp.request>[0]
    ) as unknown as Promise<NativeHttpResponse>;

    const nativeResponse = await raceAbort(nativeRequest, signal);

    // Reconstruct a standard Response. When the response is JSON the native
    // layer hands back a parsed object, so re-stringify it for `.json()`/`.text()`.
    const responseContentType =
      nativeResponse.headers['Content-Type'] ?? nativeResponse.headers['content-type'];
    let responseBody: BodyInit | null =
      responseContentType?.startsWith('application/json')
        ? JSON.stringify(nativeResponse.data)
        : (nativeResponse.data as BodyInit);
    // 204/205 responses must have a null body or the Response constructor throws.
    if (nativeResponse.status === 204 || nativeResponse.status === 205) {
      responseBody = null;
    }

    const response = new Response(responseBody, {
      status: nativeResponse.status,
      headers: nativeResponse.headers,
    });
    // Response.url is a read-only inherited getter — define it so callers that
    // read response.url (redirect detection, cordova-style plugins) see the real URL.
    Object.defineProperty(response, 'url', { value: nativeResponse.url });
    return response;
  };
}

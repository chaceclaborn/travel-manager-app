import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';

const OLD_PROJECT_REF = 'biaxoishtoysdjfiqddl';

export async function proxy(request: NextRequest) {
  // Rate limit the public /share/:token page to prevent brute-force token
  // enumeration. This runs before the Supabase session refresh below because
  // the page is intentionally unauthenticated — we don't want attackers
  // pinning us into expensive DB lookups per token.
  if (request.nextUrl.pathname.startsWith('/share/')) {
    const limited = rateLimit(request, 'read');
    if (limited) return limited;
  }

  // CSRF protection: verify Origin header on state-changing API requests.
  // Defense-in-depth — the primary CSRF defense is the auth cookie's SameSite attribute.
  // If Origin is present and mismatches Host, reject (browser-based attacks always send Origin).
  // If Origin is absent, allow through — this means server-to-server or curl, which won't
  // have the auth cookie anyway, so Supabase auth will reject unauthorized requests.
  const method = request.method;
  const pathname = request.nextUrl.pathname;
  const isMutationApi = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method) && pathname.startsWith('/api/');

  if (isMutationApi) {
    // CSRF defense 1: Origin header validation.
    // Browsers always send Origin on cross-origin requests; if it mismatches Host, reject.
    // Absent Origin means server-to-server/curl which won't have the auth cookie anyway.
    const origin = request.headers.get('origin');
    if (origin) {
      const host = request.headers.get('host');
      if (!host) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      const originHost = new URL(origin).host;
      if (originHost !== host) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    // CSRF defense 2: Content-Type enforcement.
    // HTML forms can only send application/x-www-form-urlencoded, multipart/form-data,
    // or text/plain. Requiring application/json blocks form-based CSRF attacks.
    // Skip for bodyless requests (DELETE, POST with no body) — no data to forge.
    const contentType = request.headers.get('content-type') || '';
    const contentLength = request.headers.get('content-length');
    const hasBody = contentLength !== null && contentLength !== '0';

    if (hasBody) {
      const isFileUpload = pathname.endsWith('/receipt') || pathname.endsWith('/attachments');
      if (isFileUpload) {
        if (!contentType.startsWith('multipart/form-data') && !contentType.startsWith('application/json')) {
          return NextResponse.json(
            { error: 'Content-Type must be multipart/form-data or application/json' },
            { status: 415 }
          );
        }
      } else {
        if (!contentType.startsWith('application/json')) {
          return NextResponse.json(
            { error: 'Content-Type must be application/json' },
            { status: 415 }
          );
        }
      }
    }
  }

  let supabaseResponse = NextResponse.next({ request });

  const staleCookies = request.cookies
    .getAll()
    .filter((c) => c.name.startsWith(`sb-${OLD_PROJECT_REF}-`));

  if (staleCookies.length > 0) {
    staleCookies.forEach((c) => request.cookies.delete(c.name));
    supabaseResponse = NextResponse.next({ request });
    staleCookies.forEach((c) =>
      supabaseResponse.cookies.set(c.name, '', { maxAge: 0, path: '/' })
    );
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  await supabase.auth.getUser();

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};

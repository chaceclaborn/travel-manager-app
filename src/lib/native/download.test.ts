import { describe, it, expect } from 'vitest';
import { sanitizeFileName } from './download';
import {
  base64ToBytes,
  bytesToBase64,
  fileNameFromDisposition,
} from '@/lib/travelmanager/native-fetch';

/**
 * The native export path: server bytes -> base64 across the Capacitor bridge ->
 * a file in the cache directory -> the iOS share sheet.
 *
 * Two failure modes this guards:
 *  - corrupted bytes. The fetch patch hands a STRING to `new Response()`, and
 *    the native layer decodes an unknown body as UTF-8 text by default, which
 *    mangles every non-text byte in a PDF. fetchApiBinary asks for base64 up
 *    front; these tests pin the round-trip.
 *  - a filename that escapes the cache directory or loses its extension. The
 *    name comes from a server Content-Disposition derived from a
 *    user-controlled trip title, so it is untrusted input.
 */

describe('base64 round-trip — the PDF-corruption guard', () => {
  it('round-trips arbitrary binary bytes exactly', () => {
    const bytes = new Uint8Array(1024);
    for (let i = 0; i < bytes.length; i++) bytes[i] = i % 256;
    expect(Array.from(base64ToBytes(bytesToBase64(bytes)))).toEqual(Array.from(bytes));
  });

  it('preserves a real PDF magic header', () => {
    const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37, 0x0a, 0x00, 0xff]);
    expect(Array.from(base64ToBytes(bytesToBase64(pdf)))).toEqual(Array.from(pdf));
  });

  it('handles bytes that are invalid UTF-8 — exactly what text decoding destroys', () => {
    const bytes = new Uint8Array([0xff, 0xfe, 0x80, 0x81, 0xc0, 0xc1]);
    expect(Array.from(base64ToBytes(bytesToBase64(bytes)))).toEqual(Array.from(bytes));
  });

  it('handles an empty payload', () => {
    expect(base64ToBytes(bytesToBase64(new Uint8Array(0))).length).toBe(0);
  });

  it('handles a payload larger than the chunk size (no arg-limit blowout)', () => {
    // bytesToBase64 chunks at 0x8000; go well past it.
    const big = new Uint8Array(0x8000 * 2 + 517).map((_, i) => i % 251);
    const out = base64ToBytes(bytesToBase64(big));
    expect(out.length).toBe(big.length);
    expect(out[out.length - 1]).toBe(big[big.length - 1]);
  });
});

describe('fileNameFromDisposition', () => {
  it('reads a plain filename', () => {
    expect(fileNameFromDisposition('attachment; filename="trip.pdf"')).toBe('trip.pdf');
  });

  it('prefers the RFC 6266 starred form and decodes it', () => {
    expect(
      fileNameFromDisposition(`attachment; filename="trip.pdf"; filename*=UTF-8''trip-%E6%9D%B1%E4%BA%AC.pdf`)
    ).toBe('trip-東京.pdf');
  });

  it('falls back to the plain form when the starred one is malformed', () => {
    expect(
      fileNameFromDisposition(`attachment; filename="ok.pdf"; filename*=UTF-8''%E0%A4%A`)
    ).toBe('ok.pdf');
  });

  it('tolerates an unquoted filename', () => {
    expect(fileNameFromDisposition('attachment; filename=trip.ics')).toBe('trip.ics');
  });

  it.each([null, undefined, ''])('returns null for %s', (v) => {
    expect(fileNameFromDisposition(v as string | null | undefined)).toBeNull();
  });
});

describe('sanitizeFileName — path safety', () => {
  it.each([
    ['../../etc/passwd', 'traversal with slashes'],
    ['..\\..\\windows', 'backslash traversal'],
    ['a/b/c.pdf', 'nested path'],
  ])('neutralises %s (%s)', (input) => {
    const out = sanitizeFileName(input);
    expect(out).not.toContain('/');
    expect(out).not.toContain('\\');
    expect(out).not.toContain('..');
  });

  it('never returns an empty name', () => {
    expect(sanitizeFileName('')).toBe('travel-manager-export');
    expect(sanitizeFileName('...')).toBe('travel-manager-export');
  });

  it('strips characters iOS and the Files app reject', () => {
    const out = sanitizeFileName('a:b*c?d"e<f>g|h.pdf');
    for (const bad of [':', '*', '?', '"', '<', '>', '|']) expect(out).not.toContain(bad);
  });

  it('does not leave a hidden file', () => {
    expect(sanitizeFileName('.secret.pdf').startsWith('.')).toBe(false);
  });
});

describe('sanitizeFileName — extension preservation', () => {
  // iOS decides how to preview a file, and which apps may receive it, from the
  // extension. A truncated name without ".pdf" reaches the share sheet as an
  // opaque blob with no "Add to Calendar".
  it('keeps the extension on a very long name', () => {
    const out = sanitizeFileName('x'.repeat(300) + '.pdf');
    expect(out.endsWith('.pdf')).toBe(true);
    expect(out.length).toBeLessThanOrEqual(120);
  });

  it('keeps .ics too', () => {
    const out = sanitizeFileName('y'.repeat(300) + '.ics');
    expect(out.endsWith('.ics')).toBe(true);
  });

  it('leaves a short name untouched', () => {
    expect(sanitizeFileName('trip-report.pdf')).toBe('trip-report.pdf');
  });

  it('does not invent an extension when there is none', () => {
    expect(sanitizeFileName('z'.repeat(300))).toHaveLength(120);
  });

  it('does not treat a long trailing segment as an extension', () => {
    // ".thisisnotanextension" is > 9 chars, so it must not be preserved as one.
    const out = sanitizeFileName('a'.repeat(200) + '.thisisnotanextension');
    expect(out.length).toBeLessThanOrEqual(120);
  });
});

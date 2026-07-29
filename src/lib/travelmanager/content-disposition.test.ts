import { describe, it, expect } from 'vitest';
import { attachmentDisposition } from './content-disposition';

/**
 * Regression suite for "PDF export 500s for any trip title with a non-Latin-1
 * character". HTTP header values are ByteStrings, so a single code point above
 * U+00FF made `new Response()` throw and the route's catch turned it into a
 * generic 500 — permanently, for that trip, with no explanation.
 *
 * The strongest assertion here is the constructor test: it exercises the exact
 * mechanism that failed rather than pattern-matching the string.
 */

const HOSTILE_TITLES = [
  ['emoji', 'trip-report-🇯🇵 Tokyo 2026.pdf'],
  ['CJK', 'trip-report-東京出張.pdf'],
  ['Greek', 'trip-report-Αθήνα.pdf'],
  ['Cyrillic', 'trip-report-Москва.pdf'],
  ['accented Latin-1', 'trip-report-Café Trip.pdf'],
  ['quotes', 'trip-report-Trip "quoted".pdf'],
  ['slashes', 'trip-report-a/b\\c.pdf'],
  ['newline injection attempt', 'trip-report-a\r\nX-Evil: 1.pdf'],
  ['only whitespace', '   .pdf'],
  ['very long', `trip-report-${'a'.repeat(400)}.pdf`],
] as const;

describe('attachmentDisposition — header safety', () => {
  it.each(HOSTILE_TITLES)('survives a %s title in a real Response', (_label, name) => {
    const header = attachmentDisposition(name, 'trip-report');
    expect(() => new Response('x', { headers: { 'Content-Disposition': header } })).not.toThrow();
  });

  it.each(HOSTILE_TITLES)('emits pure ASCII for a %s title', (_label, name) => {
    const header = attachmentDisposition(name, 'trip-report');
    // eslint-disable-next-line no-control-regex
    expect(/^[\x20-\x7e]*$/.test(header)).toBe(true);
  });

  it('cannot inject a second header line', () => {
    const header = attachmentDisposition('a\r\nX-Evil: 1.pdf', 'trip-report');
    // The property that matters is that no CR/LF survives anywhere — that is
    // what would terminate the header and start a new one. They are collapsed
    // by the whitespace pass before encoding, so they are removed outright
    // rather than merely escaped, and the value stays a single line.
    expect(header).not.toMatch(/[\r\n]/);
    expect(header.split('\n')).toHaveLength(1);
    // And the header still round-trips through a real Response.
    expect(() => new Response('x', { headers: { 'Content-Disposition': header } })).not.toThrow();
  });
});

describe('attachmentDisposition — the name that survives', () => {
  it('keeps a clean ASCII name intact', () => {
    expect(attachmentDisposition('trip-report-tokyo.pdf', 'trip-report')).toContain(
      'filename="trip-report-tokyo.pdf"'
    );
  });

  it('carries the real Unicode name in the starred form', () => {
    const header = attachmentDisposition('trip-report-東京.pdf', 'trip-report');
    expect(header).toContain("filename*=UTF-8''");
    expect(decodeURIComponent(header.split("filename*=UTF-8''")[1])).toBe('trip-report-東京.pdf');
  });

  it('falls back to the stem when the title has no ASCII at all', () => {
    // Would otherwise be "-.pdf" or bare ".pdf", which is a hidden file.
    expect(attachmentDisposition('東京出張.pdf', 'trip-report')).toContain(
      'filename="trip-report.pdf"'
    );
  });

  it('preserves the extension — iOS types the file from it', () => {
    for (const [, name] of HOSTILE_TITLES) {
      const ascii = /filename="([^"]+)"/.exec(attachmentDisposition(name, 'trip-report'))![1];
      expect(ascii.endsWith('.pdf'), `${ascii} lost its extension`).toBe(true);
    }
  });

  it('collapses whitespace to dashes rather than dropping it', () => {
    expect(attachmentDisposition('trip-report-New  York.pdf', 'trip-report')).toContain(
      'filename="trip-report-new-york.pdf"'
    );
  });

  it('never emits a leading dot (a hidden file)', () => {
    const ascii = /filename="([^"]+)"/.exec(attachmentDisposition('...pdf', 'trip'))![1];
    expect(ascii.startsWith('.')).toBe(false);
  });
});

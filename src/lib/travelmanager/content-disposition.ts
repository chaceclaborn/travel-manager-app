/**
 * Build a `Content-Disposition: attachment` header that survives real filenames.
 *
 * The trap: HTTP header values are WebIDL ByteStrings. A single code point above
 * U+00FF makes the `Response` constructor throw, so a trip titled in Japanese,
 * Greek or Cyrillic — or with an emoji — made the export route 500 with a
 * generic "Failed to generate report". Whitespace-collapsing the title is not
 * enough; the characters themselves are the problem.
 *
 * RFC 6266 answers this with a pair: a plain ASCII `filename` for old clients,
 * plus `filename*=UTF-8''<percent-encoded>` carrying the real name. Modern
 * clients — and `fileNameFromDisposition()` in native-fetch.ts — prefer the
 * starred form, so the iOS share sheet shows the proper title while the header
 * stays byte-safe.
 */

/** Strip a name down to characters that are safe in a bare ASCII header token. */
function toAsciiFileName(name: string, fallbackStem: string): string {
  const dot = name.lastIndexOf('.');
  // `dot >= 0`, not `dot > 0`: a name that is nothing BUT an extension (".pdf",
  // which is what a whitespace-only trip title collapses to) still has one, and
  // treating it as a stem dropped the extension entirely — leaving iOS a
  // typeless file. Require at least one char after the dot so a trailing "."
  // isn't read as an empty extension.
  const hasExt = dot >= 0 && dot < name.length - 1 && name.length - dot <= 9;
  const stem = hasExt ? name.slice(0, dot) : name;
  const ext = hasExt ? name.slice(dot) : '';

  const asciiStem = stem
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');

  return (asciiStem.length > 0 ? asciiStem : fallbackStem) + ext;
}

/**
 * @param fileName   the desired name, which may contain any Unicode
 * @param fallbackStem used when the name has no ASCII characters at all
 *                     (e.g. a wholly non-Latin title)
 */
export function attachmentDisposition(fileName: string, fallbackStem = 'download'): string {
  const trimmed = fileName.trim().replace(/\s+/g, '-');
  const ascii = toAsciiFileName(trimmed, fallbackStem);
  // encodeURIComponent covers CR/LF and quotes too, so neither form can inject
  // a second header line from a user-controlled trip title.
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(trimmed)}`;
}

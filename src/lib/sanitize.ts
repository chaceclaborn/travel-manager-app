// Input sanitization and validation utilities
// Built from scratch — no external dependencies

/** Default max length for short text fields (names, titles, codes). */
const MAX_SHORT = 255;
/** Default max length for long text fields (notes, descriptions, content). */
const MAX_LONG = 5000;

/** Fields that allow longer text (notes, descriptions, content, addresses). */
const LONG_TEXT_FIELDS = new Set([
  'notes', 'content', 'description', 'address', 'website',
]);

/**
 * Strip HTML tags and trim whitespace to prevent XSS via stored payloads.
 * Handles nested tags, self-closing tags, and HTML comments.
 */
export function sanitizeString(input: string, maxLength = MAX_SHORT): string {
  return input
    .replace(/<!--[\s\S]*?-->/g, '')   // Remove HTML comments
    .replace(/<[^>]*>/g, '')            // Remove HTML tags
    .replace(/\s+/g, ' ')              // Collapse whitespace
    .trim()
    .slice(0, maxLength);
}

/**
 * Whitelist allowed fields on an object and sanitize all string values.
 * Non-string values are passed through unchanged. Fields not in allowedFields are dropped.
 * String values are truncated: 5000 chars for notes/content/description/address/website,
 * 255 chars for everything else.
 */
export function sanitizeObject(
  obj: Record<string, unknown>,
  allowedFields: string[]
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (!(field in obj)) continue;
    const value = obj[field];
    if (typeof value === 'string') {
      const maxLen = LONG_TEXT_FIELDS.has(field) ? MAX_LONG : MAX_SHORT;
      result[field] = sanitizeString(value, maxLen);
    } else {
      result[field] = value;
    }
  }
  return result;
}

/**
 * Validate email format. Uses a practical regex — not RFC 5322 exhaustive,
 * but catches real-world abuse and rejects obvious junk.
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email) && email.length <= 254;
}

/**
 * Validate ID format — accepts both UUID v4 (Supabase user IDs) and
 * CUID (Prisma's default @id format, e.g. "cmm33dicf000004jutp2t925r").
 */
export function validateUUID(id: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const cuidRegex = /^c[a-z0-9]{20,30}$/;
  return uuidRegex.test(id) || cuidRegex.test(id);
}

/**
 * Validate ISO 8601 date strings (YYYY-MM-DD or full ISO datetime).
 * Rejects strings that parse to Invalid Date.
 */
export function validateDateString(date: string): boolean {
  // Accept YYYY-MM-DD or full ISO 8601 datetime
  const isoDateRegex = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})?)?$/;
  if (!isoDateRegex.test(date)) return false;
  const parsed = new Date(date);
  return !isNaN(parsed.getTime());
}

/**
 * Validates that a string is a recognized IANA timezone.
 * Empty/null/undefined are considered VALID (they represent "no tz set").
 * Only actively rejects non-empty strings that aren't valid IANA zones.
 * Length-capped to avoid pathological inputs.
 */
export function validateTimezone(tz: string | null | undefined): boolean {
  if (tz === null || tz === undefined || tz === '') return true;
  if (typeof tz !== 'string') return false;
  if (tz.length > 64) return false; // DoS guard
  try {
    // Intl.DateTimeFormat throws RangeError for invalid zones
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * HTML entity encoding for safe display. Encodes the five critical characters
 * that can break out of HTML context.
 */
export function escapeForDisplay(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/**
 * Validate that a value is one of the allowed enum values.
 * Useful for Prisma enum fields (TripStatus, VendorCategory, etc.).
 */
export function validateEnum(value: string, allowed: readonly string[]): boolean {
  return allowed.includes(value);
}

/**
 * Validate file content against declared MIME type using magic bytes.
 * Prevents attackers from uploading malicious files with spoofed extensions/MIME types.
 * Returns true if magic bytes match the declared type, or if the type isn't checkable.
 */
export function validateMagicBytes(buffer: Buffer, declaredMimeType: string): boolean {
  if (buffer.length < 12) return false;

  switch (declaredMimeType) {
    case 'application/pdf':
      // PDF: starts with %PDF (hex: 25 50 44 46)
      return buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46;

    case 'image/png':
      // PNG: starts with \x89PNG (hex: 89 50 4E 47)
      return buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47;

    case 'image/jpeg':
      // JPEG: starts with \xFF\xD8\xFF (hex: FF D8 FF)
      return buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;

    case 'image/webp':
      // WEBP: RIFF header, then bytes 8-11 are "WEBP"
      return (
        buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 && // RIFF
        buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50   // WEBP
      );

    case 'image/gif':
      // GIF: starts with "GIF87a" or "GIF89a" (hex: 47 49 46 38 [37|39] 61)
      return (
        buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38 &&
        (buffer[4] === 0x37 || buffer[4] === 0x39) && buffer[5] === 0x61
      );

    case 'application/msword':
      // DOC: OLE compound file starts with D0 CF 11 E0 A1 B1 1A E1
      return (
        buffer[0] === 0xD0 && buffer[1] === 0xCF && buffer[2] === 0x11 && buffer[3] === 0xE0 &&
        buffer[4] === 0xA1 && buffer[5] === 0xB1 && buffer[6] === 0x1A && buffer[7] === 0xE1
      );

    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      // DOCX: ZIP archive starts with PK (hex: 50 4B 03 04)
      return buffer[0] === 0x50 && buffer[1] === 0x4B && buffer[2] === 0x03 && buffer[3] === 0x04;

    default:
      return false;
  }
}

// Enum value lists for validation
export const TRIP_STATUS_VALUES = ['DRAFT', 'PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const;
export const VENDOR_CATEGORY_VALUES = ['SUPPLIER', 'HOTEL', 'TRANSPORT', 'RESTAURANT', 'OTHER'] as const;
export const EXPENSE_CATEGORY_VALUES = ['FLIGHT', 'HOTEL', 'TRANSPORT', 'FOOD', 'ACTIVITIES', 'INSURANCE', 'VISA', 'SHOPPING', 'OTHER'] as const;
export const BOOKING_TYPE_VALUES = ['FLIGHT', 'HOTEL', 'CAR_RENTAL', 'TRAIN', 'BUS', 'OTHER'] as const;
export const ATTACHMENT_CATEGORY_VALUES = ['FLIGHT', 'HOTEL', 'CAR_RENTAL', 'OTHER'] as const;
export const TRANSPORT_MODE_VALUES = ['FLIGHT', 'CAR'] as const;

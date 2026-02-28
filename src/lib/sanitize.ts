// Input sanitization and validation utilities
// Built from scratch — no external dependencies

/**
 * Strip HTML tags and trim whitespace to prevent XSS via stored payloads.
 * Handles nested tags, self-closing tags, and HTML comments.
 */
export function sanitizeString(input: string): string {
  return input
    .replace(/<!--[\s\S]*?-->/g, '')   // Remove HTML comments
    .replace(/<[^>]*>/g, '')            // Remove HTML tags
    .replace(/\s+/g, ' ')              // Collapse whitespace
    .trim();
}

/**
 * Whitelist allowed fields on an object and sanitize all string values.
 * Non-string values are passed through unchanged. Fields not in allowedFields are dropped.
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
      result[field] = sanitizeString(value);
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

    default:
      // Can't validate this MIME type — allow through
      return true;
  }
}

// Enum value lists for validation
export const TRIP_STATUS_VALUES = ['DRAFT', 'PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const;
export const VENDOR_CATEGORY_VALUES = ['SUPPLIER', 'HOTEL', 'TRANSPORT', 'RESTAURANT', 'OTHER'] as const;
export const EXPENSE_CATEGORY_VALUES = ['FLIGHT', 'HOTEL', 'TRANSPORT', 'FOOD', 'ACTIVITIES', 'INSURANCE', 'VISA', 'SHOPPING', 'OTHER'] as const;
export const BOOKING_TYPE_VALUES = ['FLIGHT', 'HOTEL', 'CAR_RENTAL', 'TRAIN', 'BUS', 'OTHER'] as const;
export const ATTACHMENT_CATEGORY_VALUES = ['FLIGHT', 'HOTEL', 'CAR_RENTAL', 'OTHER'] as const;

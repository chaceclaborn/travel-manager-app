import { describe, it, expect } from 'vitest';
import {
  sanitizeString,
  sanitizeObject,
  validateEmail,
  validateUUID,
  validateDateString,
  escapeForDisplay,
  validateEnum,
  validateMagicBytes,
} from '@/lib/sanitize';

describe('sanitizeString', () => {
  it('strips script tags but keeps inner text', () => {
    expect(sanitizeString('<script>alert("xss")</script>Hello')).toBe('alert("xss")Hello');
  });

  it('strips HTML comments', () => {
    expect(sanitizeString('Hello <!-- hidden --> World')).toBe('Hello World');
  });

  it('collapses multiple spaces', () => {
    expect(sanitizeString('Hello    World')).toBe('Hello World');
  });

  it('trims leading and trailing whitespace', () => {
    expect(sanitizeString('  Hello World  ')).toBe('Hello World');
  });

  it('handles nested tags', () => {
    expect(sanitizeString('<div><span>text</span></div>')).toBe('text');
  });

  it('handles self-closing tags', () => {
    expect(sanitizeString('Hello<br/>World')).toBe('HelloWorld');
  });

  it('truncates to default max length (255)', () => {
    const long = 'a'.repeat(300);
    expect(sanitizeString(long)).toHaveLength(255);
  });

  it('truncates to custom max length', () => {
    const long = 'a'.repeat(100);
    expect(sanitizeString(long, 50)).toHaveLength(50);
  });

  it('does not truncate strings under the limit', () => {
    expect(sanitizeString('short')).toBe('short');
  });
});

describe('sanitizeObject', () => {
  // Data-loss guard: edit forms send null for cleared fields so PUT can
  // blank a value. sanitizeObject must pass null through (only absent /
  // undefined-valued fields are skipped) or cleared fields silently revert.
  it('passes null through for whitelisted fields (clear-on-update contract)', () => {
    const result = sanitizeObject({ notes: null, seat: null }, ['notes', 'seat']);
    expect(result).toEqual({ notes: null, seat: null });
  });

  it('only keeps whitelisted fields', () => {
    const result = sanitizeObject({ name: 'Alice', secret: 'bad' }, ['name']);
    expect(result).toEqual({ name: 'Alice' });
    expect(result).not.toHaveProperty('secret');
  });

  it('sanitizes string values', () => {
    const result = sanitizeObject({ name: '<b>Alice</b>' }, ['name']);
    expect(result).toEqual({ name: 'Alice' });
  });

  it('passes non-string values through unchanged', () => {
    const result = sanitizeObject({ name: 'Alice', age: 30 }, ['name', 'age']);
    expect(result).toEqual({ name: 'Alice', age: 30 });
  });

  it('handles missing fields gracefully', () => {
    const result = sanitizeObject({ name: 'Alice' }, ['name', 'email']);
    expect(result).toEqual({ name: 'Alice' });
  });

  it('truncates short fields to 255 chars', () => {
    const result = sanitizeObject({ name: 'a'.repeat(300) }, ['name']);
    expect((result.name as string).length).toBe(255);
  });

  it('truncates long fields (notes) to 5000 chars', () => {
    const result = sanitizeObject({ notes: 'a'.repeat(6000) }, ['notes']);
    expect((result.notes as string).length).toBe(5000);
  });

  it('truncates content field to 5000 chars', () => {
    const result = sanitizeObject({ content: 'a'.repeat(6000) }, ['content']);
    expect((result.content as string).length).toBe(5000);
  });

  it('truncates description field to 5000 chars', () => {
    const result = sanitizeObject({ description: 'b'.repeat(6000) }, ['description']);
    expect((result.description as string).length).toBe(5000);
  });

  it('applies short limit to title, email, phone etc.', () => {
    const result = sanitizeObject(
      { title: 'x'.repeat(300), email: 'y'.repeat(300), phone: 'z'.repeat(300) },
      ['title', 'email', 'phone']
    );
    expect((result.title as string).length).toBe(255);
    expect((result.email as string).length).toBe(255);
    expect((result.phone as string).length).toBe(255);
  });
});

describe('validateEmail', () => {
  it('accepts valid email', () => {
    expect(validateEmail('user@example.com')).toBe(true);
  });

  it('accepts email with dots and plus', () => {
    expect(validateEmail('first.last+tag@example.co.uk')).toBe(true);
  });

  it('rejects missing @', () => {
    expect(validateEmail('invalid')).toBe(false);
  });

  it('rejects missing domain', () => {
    expect(validateEmail('user@')).toBe(false);
  });

  it('rejects email over 254 characters', () => {
    const longEmail = 'a'.repeat(250) + '@b.com';
    expect(validateEmail(longEmail)).toBe(false);
  });

  it('rejects empty string', () => {
    expect(validateEmail('')).toBe(false);
  });
});

describe('validateUUID', () => {
  it('accepts valid UUID v4', () => {
    expect(validateUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
  });

  it('accepts valid CUID', () => {
    expect(validateUUID('cmm33dicf000004jutp2t925r')).toBe(true);
  });

  it('rejects plain strings', () => {
    expect(validateUUID('not-a-valid-id')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(validateUUID('')).toBe(false);
  });
});

describe('validateDateString', () => {
  it('accepts YYYY-MM-DD format', () => {
    expect(validateDateString('2024-01-15')).toBe(true);
  });

  it('accepts full ISO 8601 datetime', () => {
    expect(validateDateString('2024-01-15T10:30:00Z')).toBe(true);
  });

  it('rejects non-date string', () => {
    expect(validateDateString('not-a-date')).toBe(false);
  });

  it('rejects invalid month', () => {
    expect(validateDateString('2024-13-01')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(validateDateString('')).toBe(false);
  });
});

describe('escapeForDisplay', () => {
  it('escapes ampersand', () => {
    expect(escapeForDisplay('a & b')).toBe('a &amp; b');
  });

  it('escapes less-than', () => {
    expect(escapeForDisplay('<div>')).toBe('&lt;div&gt;');
  });

  it('escapes greater-than', () => {
    expect(escapeForDisplay('a > b')).toBe('a &gt; b');
  });

  it('escapes double quotes', () => {
    expect(escapeForDisplay('"hello"')).toBe('&quot;hello&quot;');
  });

  it('escapes single quotes', () => {
    expect(escapeForDisplay("it's")).toBe("it&#x27;s");
  });

  it('escapes all five characters together', () => {
    expect(escapeForDisplay('<a href="x">&\'test\'')).toBe(
      '&lt;a href=&quot;x&quot;&gt;&amp;&#x27;test&#x27;'
    );
  });
});

describe('validateEnum', () => {
  const allowed = ['DRAFT', 'PLANNED', 'COMPLETED'] as const;

  it('accepts value in allowed list', () => {
    expect(validateEnum('DRAFT', allowed)).toBe(true);
  });

  it('rejects value not in list', () => {
    expect(validateEnum('UNKNOWN', allowed)).toBe(false);
  });

  it('is case-sensitive', () => {
    expect(validateEnum('draft', allowed)).toBe(false);
  });
});

describe('validateMagicBytes', () => {
  it('validates PDF magic bytes', () => {
    const buf = Buffer.alloc(16);
    buf[0] = 0x25; buf[1] = 0x50; buf[2] = 0x44; buf[3] = 0x46; // %PDF
    expect(validateMagicBytes(buf, 'application/pdf')).toBe(true);
  });

  it('validates PNG magic bytes', () => {
    const buf = Buffer.alloc(16);
    buf[0] = 0x89; buf[1] = 0x50; buf[2] = 0x4e; buf[3] = 0x47; // \x89PNG
    expect(validateMagicBytes(buf, 'image/png')).toBe(true);
  });

  it('validates JPEG magic bytes', () => {
    const buf = Buffer.alloc(16);
    buf[0] = 0xff; buf[1] = 0xd8; buf[2] = 0xff;
    expect(validateMagicBytes(buf, 'image/jpeg')).toBe(true);
  });

  it('validates WEBP magic bytes', () => {
    const buf = Buffer.alloc(16);
    buf[0] = 0x52; buf[1] = 0x49; buf[2] = 0x46; buf[3] = 0x46; // RIFF
    buf[8] = 0x57; buf[9] = 0x45; buf[10] = 0x42; buf[11] = 0x50; // WEBP
    expect(validateMagicBytes(buf, 'image/webp')).toBe(true);
  });

  it('rejects wrong magic bytes for PDF', () => {
    const buf = Buffer.alloc(16);
    buf[0] = 0x00; buf[1] = 0x00; buf[2] = 0x00; buf[3] = 0x00;
    expect(validateMagicBytes(buf, 'application/pdf')).toBe(false);
  });

  it('rejects buffer too short (< 12 bytes)', () => {
    const buf = Buffer.alloc(4);
    expect(validateMagicBytes(buf, 'application/pdf')).toBe(false);
  });

  it('rejects unknown MIME type', () => {
    const buf = Buffer.alloc(16);
    expect(validateMagicBytes(buf, 'text/plain')).toBe(false);
  });
});

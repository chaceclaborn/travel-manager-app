import { describe, it, expect } from 'vitest';
import { escapeForDisplay, sanitizeObject } from '@/lib/sanitize';

describe('feedback message sanitization', () => {
  it('escapes HTML entities in feedback messages', () => {
    const input = '<script>alert("xss")</script>';
    const result = escapeForDisplay(input);
    expect(result).not.toContain('<script>');
    expect(result).toContain('&lt;script&gt;');
  });

  it('preserves normal feedback text', () => {
    const input = 'The calendar is hard to use on mobile';
    expect(escapeForDisplay(input)).toBe(input);
  });

  it('escapes quotes in feedback', () => {
    const input = 'Can\'t click the "Save" button';
    const result = escapeForDisplay(input);
    expect(result).toContain('&#x27;');
    expect(result).toContain('&quot;');
  });

  it('handles empty feedback', () => {
    expect(escapeForDisplay('')).toBe('');
  });

  it('handles feedback with ampersands', () => {
    const input = 'Trips & Bookings page is slow';
    expect(escapeForDisplay(input)).toBe('Trips &amp; Bookings page is slow');
  });
});

describe('GitHub issue title formatting', () => {
  it('truncates long feedback to 80 chars with ellipsis', () => {
    const longMessage = 'A'.repeat(100);
    const title = `Feedback: ${longMessage.slice(0, 80)}${longMessage.length > 80 ? '…' : ''}`;
    expect(title.length).toBeLessThanOrEqual(91); // "Feedback: " (10) + 80 + "…" (1)
    expect(title).toContain('…');
  });

  it('does not add ellipsis for short messages', () => {
    const shortMessage = 'Fix the login button';
    const title = `Feedback: ${shortMessage.slice(0, 80)}${shortMessage.length > 80 ? '…' : ''}`;
    expect(title).toBe('Feedback: Fix the login button');
    expect(title).not.toContain('…');
  });

  it('handles exactly 80 char message without ellipsis', () => {
    const exactMessage = 'A'.repeat(80);
    const title = `Feedback: ${exactMessage.slice(0, 80)}${exactMessage.length > 80 ? '…' : ''}`;
    expect(title).not.toContain('…');
    expect(title).toBe('Feedback: ' + 'A'.repeat(80));
  });
});

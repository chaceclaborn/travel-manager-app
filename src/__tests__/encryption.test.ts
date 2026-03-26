import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { randomBytes } from 'crypto';

// Generate a valid 32-byte key for testing
const TEST_KEY = randomBytes(32).toString('base64');

describe('encryption', () => {
  beforeEach(() => {
    vi.stubEnv('OAUTH_ENCRYPTION_KEY', TEST_KEY);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // Re-import each test to pick up env changes
  async function getModule() {
    // Clear module cache so env changes take effect
    vi.resetModules();
    return import('@/lib/encryption');
  }

  it('round-trips a simple string', async () => {
    const { encryptToken, decryptToken } = await getModule();
    const plaintext = 'ya29.a0ARrdaM_some_oauth_token_here';
    const encrypted = encryptToken(plaintext);
    const decrypted = decryptToken(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it('round-trips an empty string', async () => {
    const { encryptToken, decryptToken } = await getModule();
    const encrypted = encryptToken('');
    expect(decryptToken(encrypted)).toBe('');
  });

  it('round-trips unicode content', async () => {
    const { encryptToken, decryptToken } = await getModule();
    const plaintext = 'token_with_émojis_🔑_and_中文';
    const encrypted = encryptToken(plaintext);
    expect(decryptToken(encrypted)).toBe(plaintext);
  });

  it('round-trips a long token (1000+ chars)', async () => {
    const { encryptToken, decryptToken } = await getModule();
    const plaintext = 'x'.repeat(2000);
    const encrypted = encryptToken(plaintext);
    expect(decryptToken(encrypted)).toBe(plaintext);
  });

  it('produces valid base64 output', async () => {
    const { encryptToken } = await getModule();
    const encrypted = encryptToken('test');
    expect(() => Buffer.from(encrypted, 'base64')).not.toThrow();
    // Re-encoding should match (i.e., it's clean base64)
    const buf = Buffer.from(encrypted, 'base64');
    expect(buf.toString('base64')).toBe(encrypted);
  });

  it('produces different ciphertext each time (random IV)', async () => {
    const { encryptToken } = await getModule();
    const plaintext = 'same_token_encrypted_twice';
    const a = encryptToken(plaintext);
    const b = encryptToken(plaintext);
    expect(a).not.toBe(b);
  });

  it('both encryptions decrypt to the same value', async () => {
    const { encryptToken, decryptToken } = await getModule();
    const plaintext = 'same_token_encrypted_twice';
    const a = encryptToken(plaintext);
    const b = encryptToken(plaintext);
    expect(decryptToken(a)).toBe(plaintext);
    expect(decryptToken(b)).toBe(plaintext);
  });

  it('detects tampered ciphertext (integrity check)', async () => {
    const { encryptToken, decryptToken } = await getModule();
    const encrypted = encryptToken('secret_token');
    const buf = Buffer.from(encrypted, 'base64');
    // Flip a byte in the ciphertext portion (after IV + authTag = 28 bytes)
    buf[buf.length - 1] ^= 0xff;
    const tampered = buf.toString('base64');
    expect(() => decryptToken(tampered)).toThrow();
  });

  it('detects tampered auth tag', async () => {
    const { encryptToken, decryptToken } = await getModule();
    const encrypted = encryptToken('secret_token');
    const buf = Buffer.from(encrypted, 'base64');
    // Flip a byte in the auth tag (bytes 12-27)
    buf[15] ^= 0xff;
    const tampered = buf.toString('base64');
    expect(() => decryptToken(tampered)).toThrow();
  });

  it('detects tampered IV', async () => {
    const { encryptToken, decryptToken } = await getModule();
    const encrypted = encryptToken('secret_token');
    const buf = Buffer.from(encrypted, 'base64');
    // Flip a byte in the IV (bytes 0-11)
    buf[0] ^= 0xff;
    const tampered = buf.toString('base64');
    expect(() => decryptToken(tampered)).toThrow();
  });

  it('cannot decrypt with a different key', async () => {
    const { encryptToken } = await getModule();
    const encrypted = encryptToken('secret_token');

    // Switch to a different key
    const otherKey = randomBytes(32).toString('base64');
    vi.stubEnv('OAUTH_ENCRYPTION_KEY', otherKey);
    const freshModule = await getModule();

    expect(() => freshModule.decryptToken(encrypted)).toThrow();
  });

  it('throws when OAUTH_ENCRYPTION_KEY is not set', async () => {
    vi.stubEnv('OAUTH_ENCRYPTION_KEY', '');
    // Empty string is falsy, should throw
    const { encryptToken } = await getModule();
    expect(() => encryptToken('test')).toThrow('OAUTH_ENCRYPTION_KEY environment variable is not set');
  });

  it('throws when key is wrong length', async () => {
    vi.stubEnv('OAUTH_ENCRYPTION_KEY', Buffer.from('too_short').toString('base64'));
    const { encryptToken } = await getModule();
    expect(() => encryptToken('test')).toThrow('must be 32 bytes');
  });

  it('rejects truncated ciphertext gracefully', async () => {
    const { decryptToken } = await getModule();
    // A base64 string that decodes to < 28 bytes (IV + authTag minimum)
    const tooShort = Buffer.from('truncated').toString('base64');
    expect(() => decryptToken(tooShort)).toThrow();
  });
});

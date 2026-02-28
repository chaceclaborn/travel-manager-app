import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';

function mockRequest(ip: string): NextRequest {
  return {
    headers: {
      get: (name: string) => (name === 'x-forwarded-for' ? ip : null),
    },
  } as unknown as NextRequest;
}

describe('rateLimit', () => {
  it('allows requests under the auth limit (10)', () => {
    const ip = 'auth-under-limit-1';
    for (let i = 0; i < 10; i++) {
      const result = rateLimit(mockRequest(ip), 'auth');
      expect(result).toBeNull();
    }
  });

  it('blocks the 11th auth request with 429', () => {
    const ip = 'auth-over-limit-1';
    for (let i = 0; i < 10; i++) {
      rateLimit(mockRequest(ip), 'auth');
    }
    const blocked = rateLimit(mockRequest(ip), 'auth');
    expect(blocked).not.toBeNull();
    expect(blocked!.status).toBe(429);
  });

  it('allows requests under the sensitive limit (5)', () => {
    const ip = 'sensitive-under-limit-1';
    for (let i = 0; i < 5; i++) {
      const result = rateLimit(mockRequest(ip), 'sensitive');
      expect(result).toBeNull();
    }
  });

  it('blocks the 6th sensitive request with 429', () => {
    const ip = 'sensitive-over-limit-1';
    for (let i = 0; i < 5; i++) {
      rateLimit(mockRequest(ip), 'sensitive');
    }
    const blocked = rateLimit(mockRequest(ip), 'sensitive');
    expect(blocked).not.toBeNull();
    expect(blocked!.status).toBe(429);
  });

  it('does not let different IPs interfere with each other', () => {
    const ip1 = 'isolation-ip-a';
    const ip2 = 'isolation-ip-b';
    for (let i = 0; i < 10; i++) {
      rateLimit(mockRequest(ip1), 'auth');
    }
    const result = rateLimit(mockRequest(ip2), 'auth');
    expect(result).toBeNull();
  });

  it('returns correct headers on 429 response', () => {
    const ip = 'headers-check-1';
    for (let i = 0; i < 10; i++) {
      rateLimit(mockRequest(ip), 'auth');
    }
    const blocked = rateLimit(mockRequest(ip), 'auth');
    expect(blocked).not.toBeNull();
    expect(blocked!.headers.get('Retry-After')).toBeTruthy();
    expect(blocked!.headers.get('X-RateLimit-Limit')).toBe('10');
    expect(blocked!.headers.get('X-RateLimit-Remaining')).toBe('0');
  });
});

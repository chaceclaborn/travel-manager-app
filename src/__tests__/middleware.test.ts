import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock Supabase SSR so proxy() doesn't need real env vars
vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
  }),
}));

import { proxy } from '@/proxy';

function createRequest(
  method: string,
  pathname: string,
  contentType?: string,
  hasBody = false
): NextRequest {
  const url = `http://localhost:3000${pathname}`;
  const headers = new Headers();
  headers.set('host', 'localhost:3000');
  if (contentType) {
    headers.set('content-type', contentType);
  }
  if (hasBody) {
    headers.set('content-length', '2');
  }
  return new NextRequest(url, { method, headers });
}

describe('proxy — Content-Type CSRF protection', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'test-anon-key');
  });

  // GET requests should always pass through
  it('allows GET requests without Content-Type', async () => {
    const req = createRequest('GET', '/api/trips');
    const res = await proxy(req);
    expect(res.status).toBe(200);
  });

  // Non-API routes should pass through
  it('ignores non-API routes', async () => {
    const req = createRequest('POST', '/auth/callback');
    const res = await proxy(req);
    expect(res.status).toBe(200);
  });

  // POST with application/json should pass
  it('allows POST with application/json', async () => {
    const req = createRequest('POST', '/api/trips', 'application/json');
    const res = await proxy(req);
    expect(res.status).toBe(200);
  });

  // PUT with application/json should pass
  it('allows PUT with application/json', async () => {
    const req = createRequest('PUT', '/api/trips/123', 'application/json');
    const res = await proxy(req);
    expect(res.status).toBe(200);
  });

  // PATCH with application/json should pass
  it('allows PATCH with application/json', async () => {
    const req = createRequest('PATCH', '/api/bookings/123', 'application/json');
    const res = await proxy(req);
    expect(res.status).toBe(200);
  });

  // DELETE with application/json should pass
  it('allows DELETE with application/json', async () => {
    const req = createRequest('DELETE', '/api/trips/123', 'application/json');
    const res = await proxy(req);
    expect(res.status).toBe(200);
  });

  // application/json with charset should pass
  it('allows application/json with charset parameter', async () => {
    const req = createRequest('POST', '/api/trips', 'application/json; charset=utf-8');
    const res = await proxy(req);
    expect(res.status).toBe(200);
  });

  // POST without Content-Type should be blocked when body is present (CSRF vector)
  it('blocks POST without Content-Type header', async () => {
    const req = createRequest('POST', '/api/trips', undefined, true);
    const res = await proxy(req);
    expect(res.status).toBe(415);
    const body = await res.json();
    expect(body.error).toContain('Content-Type must be application/json');
  });

  // POST with form-urlencoded should be blocked (CSRF via HTML form)
  it('blocks POST with application/x-www-form-urlencoded', async () => {
    const req = createRequest('POST', '/api/trips', 'application/x-www-form-urlencoded', true);
    const res = await proxy(req);
    expect(res.status).toBe(415);
  });

  // POST with text/plain should be blocked (CSRF via form with enctype)
  it('blocks POST with text/plain', async () => {
    const req = createRequest('POST', '/api/vendors', 'text/plain', true);
    const res = await proxy(req);
    expect(res.status).toBe(415);
  });

  // DELETE with wrong Content-Type should be blocked
  it('blocks DELETE with text/html', async () => {
    const req = createRequest('DELETE', '/api/trips/123', 'text/html', true);
    const res = await proxy(req);
    expect(res.status).toBe(415);
  });

  // Bodyless mutations (no Content-Length) should pass without Content-Type
  it('allows bodyless POST without Content-Type', async () => {
    const req = createRequest('POST', '/api/gmail/disconnect');
    const res = await proxy(req);
    expect(res.status).toBe(200);
  });

  // File upload: receipt route with multipart/form-data should pass
  it('allows multipart/form-data on receipt upload route', async () => {
    const req = createRequest(
      'POST',
      '/api/expenses/123/receipt',
      'multipart/form-data; boundary=----WebKitFormBoundary'
    );
    const res = await proxy(req);
    expect(res.status).toBe(200);
  });

  // File upload: attachments route with multipart/form-data should pass
  it('allows multipart/form-data on attachments upload route', async () => {
    const req = createRequest(
      'POST',
      '/api/trips/123/attachments',
      'multipart/form-data; boundary=----WebKitFormBoundary'
    );
    const res = await proxy(req);
    expect(res.status).toBe(200);
  });

  // File upload: receipt route with application/json should also pass
  it('allows application/json on receipt route', async () => {
    const req = createRequest('POST', '/api/expenses/123/receipt', 'application/json');
    const res = await proxy(req);
    expect(res.status).toBe(200);
  });

  // File upload route with wrong Content-Type should be blocked
  it('blocks text/plain on receipt upload route', async () => {
    const req = createRequest('POST', '/api/expenses/123/receipt', 'text/plain', true);
    const res = await proxy(req);
    expect(res.status).toBe(415);
    const body = await res.json();
    expect(body.error).toContain('multipart/form-data or application/json');
  });

  // Non-upload route should not accept multipart/form-data
  it('blocks multipart/form-data on non-upload route', async () => {
    const req = createRequest('POST', '/api/trips', 'multipart/form-data', true);
    const res = await proxy(req);
    expect(res.status).toBe(415);
  });
});

describe('proxy — Origin header CSRF protection', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'test-anon-key');
  });

  it('blocks cross-origin POST requests', async () => {
    const url = 'http://localhost:3000/api/trips';
    const headers = new Headers();
    headers.set('host', 'localhost:3000');
    headers.set('origin', 'http://evil.com');
    headers.set('content-type', 'application/json');
    const req = new NextRequest(url, { method: 'POST', headers });
    const res = await proxy(req);
    expect(res.status).toBe(403);
  });

  it('allows same-origin POST requests', async () => {
    const url = 'http://localhost:3000/api/trips';
    const headers = new Headers();
    headers.set('host', 'localhost:3000');
    headers.set('origin', 'http://localhost:3000');
    headers.set('content-type', 'application/json');
    const req = new NextRequest(url, { method: 'POST', headers });
    const res = await proxy(req);
    expect(res.status).toBe(200);
  });

  it('blocks mutation request when Host header is missing', async () => {
    const url = 'http://localhost:3000/api/trips';
    const headers = new Headers();
    headers.set('origin', 'http://localhost:3000');
    headers.set('content-type', 'application/json');
    const req = new NextRequest(url, { method: 'POST', headers });
    const res = await proxy(req);
    expect(res.status).toBe(403);
  });
});

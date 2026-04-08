import { NextRequest, NextResponse } from 'next/server';
import {
  enableTripShare,
  disableTripShare,
  updateTripShareExpiry,
  getTripShareInfo,
} from '@/lib/travelmanager/trips';
import { requireAuth } from '@/lib/travelmanager/auth';
import { rateLimit } from '@/lib/rate-limit';
import { validateUUID, validateDateString } from '@/lib/sanitize';

/**
 * Build the public shareable URL from the incoming request.
 * Prefers NEXT_PUBLIC_APP_URL (set in prod), falls back to the request's
 * origin headers so this works locally and on Vercel preview deploys.
 */
function buildShareUrl(request: NextRequest, token: string | null): string | null {
  if (!token) return null;

  const envBase = process.env.NEXT_PUBLIC_APP_URL;
  if (envBase) {
    return `${envBase.replace(/\/$/, '')}/share/${token}`;
  }

  const forwardedHost = request.headers.get('x-forwarded-host');
  const forwardedProto = request.headers.get('x-forwarded-proto');
  const host = forwardedHost ?? request.headers.get('host');
  const proto = forwardedProto ?? (host?.startsWith('localhost') ? 'http' : 'https');

  if (host) return `${proto}://${host}/share/${token}`;

  // Last resort — origin from URL (won't include the real public host behind a proxy)
  try {
    return `${new URL(request.url).origin}/share/${token}`;
  } catch {
    return `/share/${token}`;
  }
}

function serialize(
  request: NextRequest,
  info: { shareToken: string | null; shareEnabled: boolean; shareExpiresAt: Date | null }
) {
  return {
    shareToken: info.shareToken,
    shareUrl: buildShareUrl(request, info.shareToken),
    shareEnabled: info.shareEnabled,
    shareExpiresAt: info.shareExpiresAt,
  };
}

function parseExpiresAt(raw: unknown): { ok: true; value: Date | null } | { ok: false; error: string } {
  if (raw === null || raw === undefined) return { ok: true, value: null };
  if (typeof raw !== 'string') return { ok: false, error: 'expiresAt must be a string or null' };
  if (!validateDateString(raw)) return { ok: false, error: 'Invalid expiresAt date format' };
  const parsed = new Date(raw);
  if (isNaN(parsed.getTime())) return { ok: false, error: 'Invalid expiresAt date' };
  return { ok: true, value: parsed };
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const rateLimitResult = rateLimit(request, 'read');
    if (rateLimitResult) return rateLimitResult;

    const { user, response } = await requireAuth();
    if (!user) return response;

    const { id } = await params;
    if (!validateUUID(id)) {
      return NextResponse.json({ error: 'Invalid trip ID' }, { status: 400 });
    }

    const info = await getTripShareInfo(id, user.id);
    return NextResponse.json(serialize(request, info));
  } catch (error) {
    if (error instanceof Error && error.message === 'Trip not found') {
      return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
    }
    console.error('Error fetching share info:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to fetch share info' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const rateLimitResult = rateLimit(request, 'write');
    if (rateLimitResult) return rateLimitResult;

    const { user, response } = await requireAuth();
    if (!user) return response;

    const { id } = await params;
    if (!validateUUID(id)) {
      return NextResponse.json({ error: 'Invalid trip ID' }, { status: 400 });
    }

    // Body is optional — POST with no body simply enables sharing with no expiry.
    let expiresAt: Date | null = null;
    try {
      const body = await request.json();
      if (body && 'expiresAt' in body) {
        const parsed = parseExpiresAt(body.expiresAt);
        if (!parsed.ok) {
          return NextResponse.json({ error: parsed.error }, { status: 400 });
        }
        expiresAt = parsed.value;
      }
    } catch {
      // No body or invalid JSON — treat as no expiry
    }

    const info = await enableTripShare(id, user.id, expiresAt);
    return NextResponse.json(serialize(request, info));
  } catch (error) {
    if (error instanceof Error && error.message === 'Trip not found') {
      return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
    }
    console.error('Error enabling share:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to enable sharing' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const rateLimitResult = rateLimit(request, 'write');
    if (rateLimitResult) return rateLimitResult;

    const { user, response } = await requireAuth();
    if (!user) return response;

    const { id } = await params;
    if (!validateUUID(id)) {
      return NextResponse.json({ error: 'Invalid trip ID' }, { status: 400 });
    }

    const body = await request.json().catch(() => null);
    if (!body || !('expiresAt' in body)) {
      return NextResponse.json({ error: 'expiresAt is required' }, { status: 400 });
    }

    const parsed = parseExpiresAt(body.expiresAt);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const info = await updateTripShareExpiry(id, user.id, parsed.value);
    return NextResponse.json(serialize(request, info));
  } catch (error) {
    if (error instanceof Error && error.message === 'Trip not found') {
      return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
    }
    console.error('Error updating share expiry:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to update share expiry' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const rateLimitResult = rateLimit(request, 'write');
    if (rateLimitResult) return rateLimitResult;

    const { user, response } = await requireAuth();
    if (!user) return response;

    const { id } = await params;
    if (!validateUUID(id)) {
      return NextResponse.json({ error: 'Invalid trip ID' }, { status: 400 });
    }

    await disableTripShare(id, user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'Trip not found') {
      return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
    }
    console.error('Error disabling share:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to disable sharing' }, { status: 500 });
  }
}

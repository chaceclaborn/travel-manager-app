import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/travelmanager/admin';
import { rateLimit } from '@/lib/rate-limit';

export async function GET(request: NextRequest) {
  const rateLimited = rateLimit(request, 'read');
  if (rateLimited) return rateLimited;

  const { user } = await requireAdmin();
  return NextResponse.json({ isAdmin: !!user });
}

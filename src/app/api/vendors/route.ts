import { NextRequest, NextResponse } from 'next/server';
import { getVendors, createVendor } from '@/lib/travelmanager/vendors';
import { requireAuth } from '@/lib/travelmanager/auth';
import { rateLimit } from '@/lib/rate-limit';
import { sanitizeObject, validateEmail, validateEnum, VENDOR_CATEGORY_VALUES } from '@/lib/sanitize';

export async function GET(request: NextRequest) {
  try {
    const rateLimitResult = rateLimit(request, 'read');
    if (rateLimitResult) return rateLimitResult;

    const { user, response } = await requireAuth();
    if (!user) return response;

    const vendors = await getVendors(user.id);
    return NextResponse.json(vendors);
  } catch (error) {
    console.error('Error fetching vendors:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to fetch vendors' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const rateLimitResult = rateLimit(request, 'write');
    if (rateLimitResult) return rateLimitResult;

    const { user, response } = await requireAuth();
    if (!user) return response;

    const body = await request.json();
    const sanitized = sanitizeObject(body, ['name', 'category', 'email', 'phone', 'address', 'city', 'state', 'website', 'notes']);
    const { name, category, email } = sanitized;

    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    if (category && !validateEnum(category as string, VENDOR_CATEGORY_VALUES)) {
      return NextResponse.json({ error: 'Invalid vendor category' }, { status: 400 });
    }

    if (email && !validateEmail(email as string)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    const vendor = await createVendor(sanitized as unknown as Parameters<typeof createVendor>[0], user.id);
    return NextResponse.json(vendor, { status: 201 });
  } catch (error) {
    console.error('Error creating vendor:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to create vendor' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getVendorById, updateVendor, deleteVendor } from '@/lib/travelmanager/vendors';
import { requireAuth } from '@/lib/travelmanager/auth';
import { rateLimit } from '@/lib/rate-limit';
import { sanitizeObject, validateUUID, validateEmail, validateEnum, VENDOR_CATEGORY_VALUES } from '@/lib/sanitize';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const rateLimited = rateLimit(request, 'read');
    if (rateLimited) return rateLimited;

    const { user, response } = await requireAuth();
    if (!user) return response;

    const { id } = await params;
    if (!validateUUID(id)) {
      return NextResponse.json({ error: 'Invalid vendor ID' }, { status: 400 });
    }
    const vendor = await getVendorById(id, user.id);
    if (!vendor) return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
    return NextResponse.json(vendor);
  } catch (error) {
    console.error('Error fetching vendor:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to fetch vendor' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const rateLimited = rateLimit(request, 'write');
    if (rateLimited) return rateLimited;

    const { user, response } = await requireAuth();
    if (!user) return response;

    const { id } = await params;
    if (!validateUUID(id)) {
      return NextResponse.json({ error: 'Invalid vendor ID' }, { status: 400 });
    }

    const body = await request.json();
    const sanitized = sanitizeObject(body, ['name', 'category', 'email', 'phone', 'address', 'city', 'state', 'website', 'notes']);

    if (sanitized.category && !validateEnum(sanitized.category as string, VENDOR_CATEGORY_VALUES)) {
      return NextResponse.json({ error: 'Invalid vendor category' }, { status: 400 });
    }

    if (sanitized.email && !validateEmail(sanitized.email as string)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    const vendor = await updateVendor(id, sanitized as Parameters<typeof updateVendor>[1], user.id);
    return NextResponse.json(vendor);
  } catch (error) {
    console.error('Error updating vendor:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to update vendor' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const rateLimited = rateLimit(request, 'write');
    if (rateLimited) return rateLimited;

    const { user, response } = await requireAuth();
    if (!user) return response;

    const { id } = await params;
    if (!validateUUID(id)) {
      return NextResponse.json({ error: 'Invalid vendor ID' }, { status: 400 });
    }
    await deleteVendor(id, user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting vendor:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to delete vendor' }, { status: 500 });
  }
}

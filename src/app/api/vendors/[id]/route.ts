import { NextRequest, NextResponse } from 'next/server';
import { getVendorById, updateVendor, deleteVendor } from '@/lib/travelmanager/vendors';
import { requireAuth } from '@/lib/travelmanager/auth';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, response } = await requireAuth();
    if (!user) return response;

    const { id } = await params;
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
    const { user, response } = await requireAuth();
    if (!user) return response;

    const { id } = await params;
    const { name, category, email, phone, address, city, state, website, notes } = await request.json();
    const vendor = await updateVendor(id, { name, category, email, phone, address, city, state, website, notes }, user.id);
    return NextResponse.json(vendor);
  } catch (error) {
    console.error('Error updating vendor:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to update vendor' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, response } = await requireAuth();
    if (!user) return response;

    const { id } = await params;
    await deleteVendor(id, user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting vendor:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to delete vendor' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getTripVendors, linkVendorToTrip, unlinkVendorFromTrip } from '@/lib/travelmanager/trips';
import { requireAuth } from '@/lib/travelmanager/auth';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, response } = await requireAuth();
    if (!user) return response;

    const { id } = await params;
    const vendors = await getTripVendors(id, user.id);
    return NextResponse.json(vendors);
  } catch (error) {
    console.error('Error fetching trip vendors:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to fetch trip vendors' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, response } = await requireAuth();
    if (!user) return response;

    const { id } = await params;
    const body = await request.json();
    const { vendorId, notes, action } = body;

    if (!vendorId) {
      return NextResponse.json({ error: 'Vendor ID is required' }, { status: 400 });
    }

    if (action === 'unlink') {
      await unlinkVendorFromTrip(id, vendorId, user.id);
      return NextResponse.json({ success: true });
    }

    const link = await linkVendorToTrip(id, vendorId, user.id, notes);
    return NextResponse.json(link, { status: 201 });
  } catch (error) {
    console.error('Error linking vendor to trip:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to link vendor to trip' }, { status: 500 });
  }
}

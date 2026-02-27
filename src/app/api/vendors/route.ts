import { NextRequest, NextResponse } from 'next/server';
import { getVendors, createVendor } from '@/lib/travelmanager/vendors';
import { requireAuth } from '@/lib/travelmanager/auth';

export async function GET() {
  try {
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
    const { user, response } = await requireAuth();
    if (!user) return response;

    const body = await request.json();
    const { name, category, email, phone, address, city, state, website, notes } = body;

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const vendor = await createVendor({ name, category, email, phone, address, city, state, website, notes }, user.id);
    return NextResponse.json(vendor, { status: 201 });
  } catch (error) {
    console.error('Error creating vendor:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to create vendor' }, { status: 500 });
  }
}

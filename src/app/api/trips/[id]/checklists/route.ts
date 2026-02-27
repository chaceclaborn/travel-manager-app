import { NextRequest, NextResponse } from 'next/server';
import { getChecklistItems, createChecklistItem } from '@/lib/travelmanager/checklists';
import { requireAuth } from '@/lib/travelmanager/auth';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, response } = await requireAuth();
    if (!user) return response;

    const { id } = await params;
    const items = await getChecklistItems(id, user.id);
    return NextResponse.json(items);
  } catch (error) {
    console.error('Error fetching checklist items:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to fetch checklist items' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, response } = await requireAuth();
    if (!user) return response;

    const { id } = await params;
    const body = await request.json();
    const { label, sortOrder } = body;

    if (!label || !label.trim()) {
      return NextResponse.json({ error: 'Label is required' }, { status: 400 });
    }

    const item = await createChecklistItem({
      tripId: id,
      label: label.trim(),
      sortOrder,
    }, user.id);
    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    console.error('Error creating checklist item:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to create checklist item' }, { status: 500 });
  }
}

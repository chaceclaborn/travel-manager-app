import { NextRequest, NextResponse } from 'next/server';
import { updateChecklistItem, deleteChecklistItem } from '@/lib/travelmanager/checklists';
import { requireAuth } from '@/lib/travelmanager/auth';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, response } = await requireAuth();
    if (!user) return response;

    const { id } = await params;
    const body = await request.json();
    const item = await updateChecklistItem(id, body, user.id);
    return NextResponse.json(item);
  } catch (error) {
    console.error('Error updating checklist item:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to update checklist item' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, response } = await requireAuth();
    if (!user) return response;

    const { id } = await params;
    await deleteChecklistItem(id, user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting checklist item:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to delete checklist item' }, { status: 500 });
  }
}

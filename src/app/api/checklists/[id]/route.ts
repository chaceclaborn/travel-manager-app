import { NextRequest, NextResponse } from 'next/server';
import { updateChecklistItem, deleteChecklistItem } from '@/lib/travelmanager/checklists';
import { requireAuth } from '@/lib/travelmanager/auth';
import { rateLimit } from '@/lib/rate-limit';
import { sanitizeObject, validateUUID } from '@/lib/sanitize';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const rateLimited = rateLimit(request, 'write');
    if (rateLimited) return rateLimited;

    const { user, response } = await requireAuth();
    if (!user) return response;

    const { id } = await params;
    if (!validateUUID(id)) {
      return NextResponse.json({ error: 'Invalid checklist item ID' }, { status: 400 });
    }

    const body = await request.json();
    const sanitized = sanitizeObject(body, ['label', 'checked', 'sortOrder']);
    const item = await updateChecklistItem(id, sanitized as Parameters<typeof updateChecklistItem>[1], user.id);
    return NextResponse.json(item);
  } catch (error) {
    console.error('Error updating checklist item:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to update checklist item' }, { status: 500 });
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
      return NextResponse.json({ error: 'Invalid checklist item ID' }, { status: 400 });
    }
    await deleteChecklistItem(id, user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting checklist item:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to delete checklist item' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getDocumentById, updateDocument, deleteDocument } from '@/lib/travelmanager/documents';
import { requireAuth } from '@/lib/travelmanager/auth';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, response } = await requireAuth();
    if (!user) return response;

    const { id } = await params;
    const doc = await getDocumentById(id, user.id);

    if (!doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    return NextResponse.json(doc);
  } catch (error) {
    console.error('Error fetching document:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to fetch document' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, response } = await requireAuth();
    if (!user) return response;

    const { id } = await params;
    const body = await request.json();
    const doc = await updateDocument(id, body, user.id);
    return NextResponse.json(doc);
  } catch (error) {
    console.error('Error updating document:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to update document' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, response } = await requireAuth();
    if (!user) return response;

    const { id } = await params;
    await deleteDocument(id, user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting document:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to delete document' }, { status: 500 });
  }
}

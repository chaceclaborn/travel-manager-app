import { NextRequest, NextResponse } from 'next/server';
import { getDocuments, getExpiringDocuments, createDocument } from '@/lib/travelmanager/documents';
import { requireAuth } from '@/lib/travelmanager/auth';

export async function GET(request: NextRequest) {
  try {
    const { user, response } = await requireAuth();
    if (!user) return response;

    const expiring = request.nextUrl.searchParams.get('expiring');
    if (expiring === 'true') {
      const docs = await getExpiringDocuments(user.id, 90);
      return NextResponse.json(docs);
    }

    const docs = await getDocuments(user.id);
    return NextResponse.json(docs);
  } catch (error) {
    console.error('Error fetching documents:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, response } = await requireAuth();
    if (!user) return response;

    const body = await request.json();

    if (!body.type || !body.label?.trim()) {
      return NextResponse.json({ error: 'Type and label are required' }, { status: 400 });
    }

    const doc = await createDocument(body, user.id);
    return NextResponse.json(doc, { status: 201 });
  } catch (error) {
    console.error('Error creating document:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to create document' }, { status: 500 });
  }
}

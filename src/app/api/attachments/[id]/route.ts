import { NextRequest, NextResponse } from 'next/server';
import { deleteTripAttachment } from '@/lib/travelmanager/trips';
import { requireAuth } from '@/lib/travelmanager/auth';
import { createSupabaseAdmin } from '@/lib/supabase/admin';
import prisma from '@/lib/prisma';
import { validateUUID } from '@/lib/sanitize';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, response } = await requireAuth();
    if (!user) return response;

    const { id } = await params;
    if (!validateUUID(id)) {
      return NextResponse.json({ error: 'Invalid attachment ID' }, { status: 400 });
    }

    const attachment = await prisma.tripAttachment.findUnique({ where: { id } });

    if (!attachment) {
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });
    }

    const trip = await prisma.trip.findFirst({ where: { id: attachment.tripId, userId: user.id } });
    if (!trip) {
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });
    }

    const admin = createSupabaseAdmin();
    const { data, error } = await admin.storage
      .from('trip-attachments')
      .createSignedUrl(attachment.storagePath, 3600);

    if (error) {
      console.error('Error creating signed URL:', error instanceof Error ? error.message : error);
      return NextResponse.json({ error: 'Failed to get file URL' }, { status: 500 });
    }

    return NextResponse.json({ url: data.signedUrl });
  } catch (error) {
    console.error('Error fetching attachment:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to fetch attachment' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, response } = await requireAuth();
    if (!user) return response;

    const { id } = await params;
    if (!validateUUID(id)) {
      return NextResponse.json({ error: 'Invalid attachment ID' }, { status: 400 });
    }

    const attachment = await prisma.tripAttachment.findUnique({ where: { id } });

    if (!attachment) {
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });
    }

    const trip = await prisma.trip.findFirst({ where: { id: attachment.tripId, userId: user.id } });
    if (!trip) {
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });
    }

    const admin = createSupabaseAdmin();
    await admin.storage
      .from('trip-attachments')
      .remove([attachment.storagePath]);

    await deleteTripAttachment(id, user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting attachment:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to delete attachment' }, { status: 500 });
  }
}

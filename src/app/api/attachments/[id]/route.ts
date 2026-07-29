import { NextRequest, NextResponse } from 'next/server';
import { deleteTripAttachment } from '@/lib/travelmanager/trips';
import { requireAuth } from '@/lib/travelmanager/auth';
import { requireTripAccess, TripAccessError } from '@/lib/travelmanager/trip-access';
import { rateLimit } from '@/lib/rate-limit';
import { createSupabaseAdmin } from '@/lib/supabase/admin';
import prisma from '@/lib/prisma';
import { validateUUID } from '@/lib/sanitize';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const rateLimited = rateLimit(request, 'read');
    if (rateLimited) return rateLimited;

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

    await requireTripAccess(attachment.tripId, user.id, 'view');

    const admin = createSupabaseAdmin();
    // Known and accepted: this URL stays valid for its full hour regardless of
    // access being revoked in the meantime, so a removed collaborator keeps the
    // file for up to that long. Shortening the TTL is the fix if that ever
    // stops being acceptable.
    const { data, error } = await admin.storage
      .from('trip-attachments')
      .createSignedUrl(attachment.storagePath, 3600);

    if (error) {
      console.error('Error creating signed URL:', error instanceof Error ? error.message : error);
      return NextResponse.json({ error: 'Failed to get file URL' }, { status: 500 });
    }

    return NextResponse.json({ url: data.signedUrl });
  } catch (error) {
    if (error instanceof TripAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error fetching attachment:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to fetch attachment' }, { status: 500 });
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
      return NextResponse.json({ error: 'Invalid attachment ID' }, { status: 400 });
    }

    const attachment = await prisma.tripAttachment.findUnique({ where: { id } });

    if (!attachment) {
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });
    }

    await requireTripAccess(attachment.tripId, user.id, 'edit');

    const admin = createSupabaseAdmin();
    await admin.storage
      .from('trip-attachments')
      .remove([attachment.storagePath]);

    await deleteTripAttachment(id, user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof TripAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error deleting attachment:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to delete attachment' }, { status: 500 });
  }
}

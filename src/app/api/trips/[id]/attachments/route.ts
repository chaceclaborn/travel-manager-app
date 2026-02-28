import { NextRequest, NextResponse } from 'next/server';
import { getTripAttachments, createTripAttachment } from '@/lib/travelmanager/trips';
import { requireAuth } from '@/lib/travelmanager/auth';
import { createSupabaseAdmin } from '@/lib/supabase/admin';
import { validateUUID, validateEnum, ATTACHMENT_CATEGORY_VALUES } from '@/lib/sanitize';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
]);

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, response } = await requireAuth();
    if (!user) return response;

    const { id } = await params;
    if (!validateUUID(id)) {
      return NextResponse.json({ error: 'Invalid trip ID' }, { status: 400 });
    }
    const attachments = await getTripAttachments(id, user.id);
    return NextResponse.json(attachments);
  } catch (error) {
    console.error('Error fetching attachments:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to fetch attachments' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, response } = await requireAuth();
    if (!user) return response;

    const { id: tripId } = await params;
    if (!validateUUID(tripId)) {
      return NextResponse.json({ error: 'Invalid trip ID' }, { status: 400 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const category = (formData.get('category') as string) || 'OTHER';

    if (!validateEnum(category, ATTACHMENT_CATEGORY_VALUES)) {
      return NextResponse.json({ error: 'Invalid attachment category' }, { status: 400 });
    }

    if (!file) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File size must be 10MB or less' }, { status: 400 });
    }

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json({ error: 'File type not allowed. Accepted: PDF, Word, JPEG, PNG, GIF, WebP' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Sanitize filename to prevent path traversal and injection
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `${user.id}/${tripId}/${Date.now()}-${safeName}`;

    const admin = createSupabaseAdmin();
    const { error: uploadError } = await admin.storage
      .from('trip-attachments')
      .upload(storagePath, buffer, {
        contentType: file.type,
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError instanceof Error ? uploadError.message : uploadError);
      return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 });
    }

    const attachment = await createTripAttachment({
      tripId,
      fileName: safeName,
      fileSize: file.size,
      mimeType: file.type,
      storagePath,
      category: category as 'FLIGHT' | 'HOTEL' | 'CAR_RENTAL' | 'OTHER',
    }, user.id);

    return NextResponse.json(attachment, { status: 201 });
  } catch (error) {
    console.error('Error uploading attachment:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to upload attachment' }, { status: 500 });
  }
}

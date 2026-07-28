import { NextRequest, NextResponse } from 'next/server';
import { updateExpense } from '@/lib/travelmanager/expenses';
import { requireAuth } from '@/lib/travelmanager/auth';
import { requireTripAccess, TripAccessError } from '@/lib/travelmanager/trip-access';
import { rateLimit } from '@/lib/rate-limit';
import { createSupabaseAdmin } from '@/lib/supabase/admin';
import prisma from '@/lib/prisma';
import { validateUUID, validateMagicBytes } from '@/lib/sanitize';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'application/pdf',
]);

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const rateLimited = rateLimit(request, 'write');
    if (rateLimited) return rateLimited;

    const { user, response } = await requireAuth();
    if (!user) return response;

    const { id: expenseId } = await params;
    if (!validateUUID(expenseId)) {
      return NextResponse.json({ error: 'Invalid expense ID' }, { status: 400 });
    }

    const expense = await prisma.expense.findUnique({
      where: { id: expenseId },
      select: { tripId: true },
    });
    if (!expense) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
    }

    const access = await requireTripAccess(expense.tripId, user.id, 'edit');

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File size must be 5MB or less' }, { status: 400 });
    }

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json({ error: 'File type not allowed. Accepted: JPG, PNG, PDF' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    if (!validateMagicBytes(buffer, file.type)) {
      return NextResponse.json({ error: 'File content does not match declared type' }, { status: 400 });
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    // Keyed on the trip OWNER, not the uploader. Account deletion wipes the
    // leaving user's whole storage prefix, so a collaborator's receipt filed
    // under their own id would vanish out of the owner's live trip the day they
    // close their account. Storage lifetime has to match trip lifetime.
    const storagePath = `${access.ownerId}/receipts/${expenseId}/${Date.now()}-${safeName}`;

    const admin = createSupabaseAdmin();
    const { error: uploadError } = await admin.storage
      .from('trip-attachments')
      .upload(storagePath, buffer, {
        contentType: file.type,
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError instanceof Error ? uploadError.message : uploadError);
      return NextResponse.json({ error: 'Failed to upload receipt' }, { status: 500 });
    }

    const updated = await updateExpense(expenseId, { receiptPath: storagePath }, user.id);

    return NextResponse.json(updated, { status: 201 });
  } catch (error) {
    if (error instanceof TripAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error uploading receipt:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to upload receipt' }, { status: 500 });
  }
}

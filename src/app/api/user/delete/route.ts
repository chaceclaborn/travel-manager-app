import { NextRequest, NextResponse } from 'next/server';
import { deleteAllUserData, createAuditLog } from '@/lib/travelmanager/trips';
import { requireAuth } from '@/lib/travelmanager/auth';
import { createSupabaseAdmin } from '@/lib/supabase/admin';
import { rateLimit } from '@/lib/rate-limit';

export async function DELETE(request: NextRequest) {
  try {
    const rateLimitResult = rateLimit(request, 'sensitive');
    if (rateLimitResult) return rateLimitResult;

    const { user, response } = await requireAuth();
    if (!user) return response;

    const admin = createSupabaseAdmin();

    // Delete all Prisma data (trips, vendors, clients, audit logs, etc.)
    await deleteAllUserData(user.id);

    // Delete all files from Supabase Storage (files are nested: userId/tripId/file)
    const { data: tripDirs } = await admin.storage.from('trip-attachments').list(user.id);
    if (tripDirs && tripDirs.length > 0) {
      for (const dir of tripDirs) {
        const { data: files } = await admin.storage
          .from('trip-attachments')
          .list(`${user.id}/${dir.name}`);
        if (files && files.length > 0) {
          const filePaths = files.map((f: { name: string }) => `${user.id}/${dir.name}/${f.name}`);
          await admin.storage.from('trip-attachments').remove(filePaths);
        }
      }
    }

    // Create final audit log entry before deleting auth user
    await createAuditLog(user.id, 'account_delete');

    // Delete Supabase Auth user
    await admin.auth.admin.deleteUser(user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting user account:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 });
  }
}

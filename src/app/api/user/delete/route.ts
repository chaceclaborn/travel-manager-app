import { NextRequest, NextResponse } from 'next/server';
import { deleteAllUserData } from '@/lib/travelmanager/trips';
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

    // Apple Guideline 5.1.1(v) requires complete account deletion. We do
    // NOT write a final audit log because deleteAllUserData drops all
    // AuditLog rows for this user (and then the User row itself) — any
    // log we wrote here would be wiped milliseconds later anyway. If you
    // later add external log shipping (Sentry / Datadog), emit the
    // 'account_delete' event there, not in the DB.

    // Delete all files from Supabase Storage (files are nested: userId/tripId/file).
    // Do this before wiping DB rows — once the User row is gone we lose
    // the ability to audit what was removed if storage deletion partially fails.
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

    // Delete all Prisma data (trips, vendors, clients, meetings, feedback,
    // audit logs, oauth tokens, device tokens, click events, and finally
    // the User row itself).
    await deleteAllUserData(user.id);

    // Delete Supabase Auth user (requires service role key)
    await admin.auth.admin.deleteUser(user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting user account:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 });
  }
}

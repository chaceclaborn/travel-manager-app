import { NextResponse } from 'next/server';
import { getUserData, createAuditLog } from '@/lib/travelmanager/trips';
import { requireAuth } from '@/lib/travelmanager/auth';

export async function GET() {
  try {
    const { user, response } = await requireAuth();
    if (!user) return response;

    const data = await getUserData(user.id);
    await createAuditLog(user.id, 'data_export');

    return new NextResponse(JSON.stringify(data, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': 'attachment; filename="travel-manager-export.json"',
      },
    });
  } catch (error) {
    console.error('Error exporting user data:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to export data' }, { status: 500 });
  }
}

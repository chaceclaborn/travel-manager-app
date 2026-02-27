import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/travelmanager/auth';

export async function GET() {
  try {
    const { user: authUser, response } = await requireAuth();
    if (!authUser) return response;

    const user = await prisma.user.findUnique({ where: { id: authUser.id } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error('Error fetching user profile:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to fetch user profile' }, { status: 500 });
  }
}

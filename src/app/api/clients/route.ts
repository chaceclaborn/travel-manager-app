import { NextRequest, NextResponse } from 'next/server';
import { getClients, createClient } from '@/lib/travelmanager/clients';
import { requireAuth } from '@/lib/travelmanager/auth';
import { rateLimit } from '@/lib/rate-limit';
import { sanitizeObject, validateEmail } from '@/lib/sanitize';

export async function GET(request: NextRequest) {
  try {
    const rateLimitResult = rateLimit(request, 'read');
    if (rateLimitResult) return rateLimitResult;

    const { user, response } = await requireAuth();
    if (!user) return response;

    const clients = await getClients(user.id);
    return NextResponse.json(clients);
  } catch (error) {
    console.error('Error fetching clients:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to fetch clients' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const rateLimitResult = rateLimit(request, 'write');
    if (rateLimitResult) return rateLimitResult;

    const { user, response } = await requireAuth();
    if (!user) return response;

    const body = await request.json();
    const sanitized = sanitizeObject(body, ['name', 'company', 'email', 'phone', 'notes']);
    const { name, company, email, phone, notes } = sanitized;

    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    if (email && !validateEmail(email as string)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    const client = await createClient({ name, company, email, phone, notes } as Parameters<typeof createClient>[0], user.id);
    return NextResponse.json(client, { status: 201 });
  } catch (error) {
    console.error('Error creating client:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to create client' }, { status: 500 });
  }
}

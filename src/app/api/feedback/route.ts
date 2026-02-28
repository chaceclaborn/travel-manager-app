import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/travelmanager/auth';
import { rateLimit } from '@/lib/rate-limit';
import { escapeForDisplay } from '@/lib/sanitize';

export async function POST(request: NextRequest) {
  try {
    const rateLimited = rateLimit(request, 'sensitive');
    if (rateLimited) return rateLimited;

    const { user, response } = await requireAuth();
    if (!user) return response;

    const { message } = await request.json();
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json({ error: 'Message required' }, { status: 400 });
    }
    const safeMessage = escapeForDisplay(message.trim().slice(0, 1000));

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Travel Manager <onboarding@resend.dev>',
        to: [process.env.CONTACT_RECIPIENT_EMAIL!],
        subject: 'App Feedback',
        html: `<p><strong>Feedback from user:</strong> ${user.id}</p><p>${safeMessage.replace(/\n/g, '<br>')}</p>`,
      }),
    });

    if (!res.ok) return NextResponse.json({ error: 'Failed to send' }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error sending feedback:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to send feedback' }, { status: 500 });
  }
}

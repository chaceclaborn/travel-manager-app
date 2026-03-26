import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/travelmanager/auth';
import { rateLimit } from '@/lib/rate-limit';
import { escapeForDisplay } from '@/lib/sanitize';
import prisma from '@/lib/prisma';

const GITHUB_REPO = 'chaceclaborn/travel-manager-app';
const FEEDBACK_LABEL = 'user-feedback';

async function createGitHubIssue(feedbackId: string, message: string) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.warn('GITHUB_TOKEN not set — skipping GitHub Issue creation');
    return;
  }

  const title = `Feedback: ${message.slice(0, 80)}${message.length > 80 ? '…' : ''}`;
  const body = [
    `**Feedback ID:** \`${feedbackId}\``,
    `**Submitted:** ${new Date().toISOString()}`,
    '',
    '---',
    '',
    message,
  ].join('\n');

  const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/issues`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify({ title, body, labels: [FEEDBACK_LABEL] }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('Failed to create GitHub Issue:', res.status, err);
  }
}

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

    const feedback = await prisma.feedback.create({
      data: {
        userId: user.id,
        message: safeMessage,
      },
    });

    await Promise.allSettled([
      createGitHubIssue(feedback.id, safeMessage),
      fetch('https://api.resend.com/emails', {
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
      }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error sending feedback:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to send feedback' }, { status: 500 });
  }
}

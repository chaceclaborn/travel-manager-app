import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/travelmanager/auth';
import { rateLimit } from '@/lib/rate-limit';
import { getGmailClient, searchEmails, getEmailContent } from '@/lib/travelmanager/gmail';
import { parseBookingEmail } from '@/lib/travelmanager/email-parser';
import { classifyEmailBatch } from '@/lib/travelmanager/email-classifier';
import { sanitizeString } from '@/lib/sanitize';

export async function GET(request: NextRequest) {
  try {
    const rateLimitResult = rateLimit(request, 'read');
    if (rateLimitResult) return rateLimitResult;

    const { user, response } = await requireAuth();
    if (!user) return response;

    const gmailClient = await getGmailClient(user.id);
    if (!gmailClient) {
      return NextResponse.json(
        { error: 'Gmail not connected', code: 'NOT_CONNECTED' },
        { status: 401 }
      );
    }

    // If messageId is provided, parse that specific email
    const messageId = request.nextUrl.searchParams.get('messageId');
    if (messageId) {
      if (!/^[a-zA-Z0-9]+$/.test(messageId)) {
        return NextResponse.json({ error: 'Invalid message ID' }, { status: 400 });
      }
      const { html, plainText, headers } = await getEmailContent(gmailClient, messageId);
      const parsed = await parseBookingEmail(html, plainText, headers);
      return NextResponse.json(parsed);
    }

    // Otherwise, search emails
    const rawQuery = request.nextUrl.searchParams.get('q');
    if (!rawQuery || rawQuery.length < 2) {
      return NextResponse.json({ error: 'Search query required (min 2 chars)' }, { status: 400 });
    }

    const query = sanitizeString(rawQuery);
    const maxResults = Math.min(
      parseInt(request.nextUrl.searchParams.get('maxResults') || '10', 10) || 10,
      20
    );

    const results = await searchEmails(gmailClient, query, maxResults);

    // Run AI classification on results (non-blocking — if it fails, frontend scoring handles it)
    const useAI = request.nextUrl.searchParams.get('classify') !== 'false';
    let classifications: Record<string, { category: string; confidence: number; reason: string }> = {};

    if (useAI && results.length > 0) {
      try {
        const classMap = await classifyEmailBatch(results);
        for (const [id, cls] of classMap) {
          classifications[id] = {
            category: cls.category,
            confidence: cls.confidence,
            reason: cls.reason,
          };
        }
      } catch {
        // AI classification failed — frontend scoring will handle categorization
      }
    }

    return NextResponse.json({ results, classifications });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gmail search failed';
    if (message.includes('invalid_grant') || message.includes('Token has been expired')) {
      return NextResponse.json(
        { error: 'Gmail session expired. Please reconnect.', code: 'NOT_CONNECTED' },
        { status: 401 }
      );
    }
    return NextResponse.json({ error: 'Gmail search failed' }, { status: 500 });
  }
}

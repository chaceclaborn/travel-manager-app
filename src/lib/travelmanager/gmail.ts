import { google } from 'googleapis';
import prisma from '@/lib/prisma';

const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];

export function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_GMAIL_REDIRECT_URI
  );
}

export function getGmailAuthUrl(state?: string) {
  const oauth2Client = getOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
    state: state || undefined,
  });
}

export async function exchangeCodeForTokens(code: string) {
  const oauth2Client = getOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}

export async function getGmailClient(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { gmailAccessToken: true, gmailRefreshToken: true, gmailTokenExpiry: true },
  });

  if (!user?.gmailRefreshToken) return null;

  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({
    access_token: user.gmailAccessToken,
    refresh_token: user.gmailRefreshToken,
    expiry_date: user.gmailTokenExpiry?.getTime(),
  });

  // Auto-refresh if expired
  const now = Date.now();
  const expiry = user.gmailTokenExpiry?.getTime() || 0;
  if (now >= expiry - 60_000) {
    try {
      const { credentials } = await oauth2Client.refreshAccessToken();
      await prisma.user.update({
        where: { id: userId },
        data: {
          gmailAccessToken: credentials.access_token,
          gmailTokenExpiry: credentials.expiry_date ? new Date(credentials.expiry_date) : null,
        },
      });
      oauth2Client.setCredentials(credentials);
    } catch {
      // Refresh token revoked — clear Gmail connection
      await prisma.user.update({
        where: { id: userId },
        data: { gmailAccessToken: null, gmailRefreshToken: null, gmailTokenExpiry: null },
      });
      return null;
    }
  }

  return google.gmail({ version: 'v1', auth: oauth2Client });
}

export async function revokeGmailAccess(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { gmailAccessToken: true, gmailRefreshToken: true },
  });

  if (user?.gmailAccessToken) {
    try {
      const oauth2Client = getOAuth2Client();
      await oauth2Client.revokeToken(user.gmailAccessToken);
    } catch {
      // Token may already be revoked — that's fine
    }
  }

  await prisma.user.update({
    where: { id: userId },
    data: { gmailAccessToken: null, gmailRefreshToken: null, gmailTokenExpiry: null },
  });
}

export interface GmailSearchResult {
  id: string;
  subject: string;
  from: string;
  date: string;
  snippet: string;
}

export async function searchEmails(
  gmailClient: ReturnType<typeof google.gmail>,
  query: string,
  maxResults = 10
): Promise<GmailSearchResult[]> {
  const res = await gmailClient.users.messages.list({
    userId: 'me',
    q: query,
    maxResults: Math.min(maxResults, 20),
  });

  const messages = res.data.messages || [];
  const results: GmailSearchResult[] = [];

  for (const msg of messages) {
    if (!msg.id) continue;
    const detail = await gmailClient.users.messages.get({
      userId: 'me',
      id: msg.id,
      format: 'metadata',
      metadataHeaders: ['Subject', 'From', 'Date'],
    });

    const headers = detail.data.payload?.headers || [];
    const getHeader = (name: string) => headers.find((h) => h.name === name)?.value || '';

    results.push({
      id: msg.id,
      subject: getHeader('Subject'),
      from: getHeader('From'),
      date: getHeader('Date'),
      snippet: detail.data.snippet || '',
    });
  }

  return results;
}

function findBodyPart(
  payload: { mimeType?: string | null; body?: { data?: string | null } | null; parts?: any[] | null } | null | undefined,
  mimeType: string
): string | null {
  if (!payload) return null;
  if (payload.mimeType === mimeType && payload.body?.data) {
    return Buffer.from(payload.body.data, 'base64url').toString('utf-8');
  }
  if (payload.parts) {
    for (const part of payload.parts) {
      const result = findBodyPart(part, mimeType);
      if (result) return result;
    }
  }
  return null;
}

export async function getEmailContent(
  gmailClient: ReturnType<typeof google.gmail>,
  messageId: string
): Promise<{ html: string; plainText: string; headers: Record<string, string> }> {
  const detail = await gmailClient.users.messages.get({
    userId: 'me',
    id: messageId,
    format: 'full',
  });

  const payload = detail.data.payload;
  const html = findBodyPart(payload, 'text/html') || '';
  const plainText = findBodyPart(payload, 'text/plain') || '';

  const rawHeaders = payload?.headers || [];
  const headers: Record<string, string> = {};
  for (const h of rawHeaders) {
    if (h.name && h.value) headers[h.name] = h.value;
  }

  return { html, plainText, headers };
}

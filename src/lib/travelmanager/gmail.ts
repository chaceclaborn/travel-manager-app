import { google } from 'googleapis';
import prisma from '@/lib/prisma';
import { encryptToken, decryptToken } from '@/lib/encryption';

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

export async function storeOAuthTokens(
  userId: string,
  tokens: { access_token?: string | null; refresh_token?: string | null; expiry_date?: number | null }
) {
  const encryptedAccess = tokens.access_token ? encryptToken(tokens.access_token) : null;
  const encryptedRefresh = tokens.refresh_token ? encryptToken(tokens.refresh_token) : null;

  await prisma.oAuthToken.upsert({
    where: { userId_provider: { userId, provider: 'google' } },
    create: {
      userId,
      provider: 'google',
      accessToken: encryptedAccess || '',
      refreshToken: encryptedRefresh,
      expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
    },
    update: {
      accessToken: encryptedAccess || '',
      ...(encryptedRefresh ? { refreshToken: encryptedRefresh } : {}),
      expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
    },
  });
}

export async function getGmailClient(userId: string) {
  const tokenRecord = await prisma.oAuthToken.findUnique({
    where: { userId_provider: { userId, provider: 'google' } },
  });

  if (!tokenRecord?.refreshToken) return null;

  const accessToken = tokenRecord.accessToken ? decryptToken(tokenRecord.accessToken) : null;
  const refreshToken = decryptToken(tokenRecord.refreshToken);

  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
    expiry_date: tokenRecord.expiresAt?.getTime(),
  });

  // Auto-refresh if expired
  const now = Date.now();
  const expiry = tokenRecord.expiresAt?.getTime() || 0;
  if (now >= expiry - 60_000) {
    try {
      const { credentials } = await oauth2Client.refreshAccessToken();
      await storeOAuthTokens(userId, {
        access_token: credentials.access_token,
        refresh_token: credentials.refresh_token,
        expiry_date: credentials.expiry_date,
      });
      oauth2Client.setCredentials(credentials);
    } catch {
      // Refresh token revoked — clear Gmail connection
      await prisma.oAuthToken.delete({
        where: { userId_provider: { userId, provider: 'google' } },
      });
      return null;
    }
  }

  return google.gmail({ version: 'v1', auth: oauth2Client });
}

export async function revokeGmailAccess(userId: string) {
  const tokenRecord = await prisma.oAuthToken.findUnique({
    where: { userId_provider: { userId, provider: 'google' } },
  });

  if (tokenRecord?.accessToken) {
    try {
      const accessToken = decryptToken(tokenRecord.accessToken);
      const oauth2Client = getOAuth2Client();
      await oauth2Client.revokeToken(accessToken);
    } catch {
      // Token may already be revoked — that's fine
    }
  }

  await prisma.oAuthToken.deleteMany({
    where: { userId, provider: 'google' },
  });
}

export async function isGmailConnected(userId: string): Promise<boolean> {
  const tokenRecord = await prisma.oAuthToken.findUnique({
    where: { userId_provider: { userId, provider: 'google' } },
    select: { refreshToken: true },
  });
  return !!tokenRecord?.refreshToken;
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

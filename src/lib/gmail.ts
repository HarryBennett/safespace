import 'server-only';
/**
 * src/lib/gmail.ts
 *
 * Gmail API integration for SafeSpace.
 * Handles OAuth, token management, email reading/sending,
 * and auto-matching emails to cases.
 */

import { google, gmail_v1 } from 'googleapis';

// ── OAuth client ──────────────────────────────────────────────────────────────

export function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL}/api/gmail/callback`
  );
}

export function getAuthUrl(staffId: string, state?: string) {
  const oauth2Client = getOAuthClient();
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',           // Force refresh token on every auth
    scope: [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/contacts.readonly',    // Resolve caller names
      // 'https://www.googleapis.com/auth/voice',             // Uncomment when Voice API available
    ],
    state: JSON.stringify({ staffId, returnTo: state || '/' }),
  });
}

// ── Token management ──────────────────────────────────────────────────────────
// In production, store tokens in Supabase `gmail_tokens` table (encrypted at rest)

export interface GmailToken {
  staff_id: string;
  access_token: string;
  refresh_token: string;
  expiry_date: number;
  email: string;       // The Gmail address (staff's Google Workspace email)
}

// In-memory for prototype — replace with Supabase in production
const _tokens = new Map<string, GmailToken>();

export function storeToken(token: GmailToken) {
  _tokens.set(token.staff_id, token);
  // Production: await supabase.from('gmail_tokens').upsert({ staff_id: token.staff_id, ...encrypted })
}

export function getToken(staffId: string): GmailToken | undefined {
  return _tokens.get(staffId);
  // Production: await supabase.from('gmail_tokens').select().eq('staff_id', staffId).single()
}

export function isConnected(staffId: string): boolean {
  return _tokens.has(staffId);
}

export function getAuthenticatedClient(staffId: string) {
  const token = getToken(staffId);
  if (!token) throw new Error('Gmail not connected for this staff member');
  const client = getOAuthClient();
  client.setCredentials({
    access_token: token.access_token,
    refresh_token: token.refresh_token,
    expiry_date: token.expiry_date,
  });
  // Auto-refresh tokens
  client.on('tokens', (newTokens) => {
    storeToken({ ...token, access_token: newTokens.access_token || token.access_token, refresh_token: newTokens.refresh_token || token.refresh_token, expiry_date: newTokens.expiry_date || token.expiry_date });
  });
  return client;
}

// ── Email parsing ─────────────────────────────────────────────────────────────

export interface ParsedEmail {
  gmail_id: string;
  thread_id: string;
  from: string;
  from_name: string;
  to: string[];
  subject: string;
  body_text: string;
  body_html?: string;
  date: Date;
  labels: string[];
  has_attachments: boolean;
  attachment_count: number;
}

function decodeBase64(data: string): string {
  try {
    return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');
  } catch {
    return '';
  }
}

function extractBody(payload: gmail_v1.Schema$MessagePart): { text: string; html: string } {
  let text = '';
  let html = '';

  if (!payload) return { text, html };

  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    text = decodeBase64(payload.body.data);
  } else if (payload.mimeType === 'text/html' && payload.body?.data) {
    html = decodeBase64(payload.body.data);
  } else if (payload.parts) {
    for (const part of payload.parts) {
      const sub = extractBody(part);
      text += sub.text;
      html += sub.html;
    }
  }

  return { text, html };
}

function parseHeader(headers: gmail_v1.Schema$MessagePartHeader[], name: string): string {
  return headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value || '';
}

export function parseGmailMessage(msg: gmail_v1.Schema$Message): ParsedEmail | null {
  if (!msg.payload?.headers) return null;

  const headers = msg.payload.headers;
  const from = parseHeader(headers, 'from');
  const fromMatch = from.match(/^(?:"?([^"<]*)"?\s*)?<?([^>]+)>?$/);
  const fromName = fromMatch?.[1]?.trim() || fromMatch?.[2]?.split('@')[0] || from;
  const fromEmail = fromMatch?.[2]?.trim() || from;

  const toHeader = parseHeader(headers, 'to');
  const toEmails = toHeader.split(',').map(e => e.trim()).filter(Boolean);

  const { text, html } = extractBody(msg.payload);

  const hasAttachments = (msg.payload.parts || []).some(
    p => p.filename && p.filename.length > 0
  );
  const attachmentCount = (msg.payload.parts || []).filter(
    p => p.filename && p.filename.length > 0
  ).length;

  return {
    gmail_id: msg.id || '',
    thread_id: msg.threadId || '',
    from: fromEmail,
    from_name: fromName,
    to: toEmails,
    subject: parseHeader(headers, 'subject'),
    body_text: text.trim().slice(0, 2000),  // Truncate for storage
    body_html: html || undefined,
    date: new Date(parseInt(msg.internalDate || '0')),
    labels: msg.labelIds || [],
    has_attachments: hasAttachments,
    attachment_count: attachmentCount,
  };
}

// ── Case matching ─────────────────────────────────────────────────────────────

export interface CaseMatch {
  case_id: string;
  case_ref: string;
  family_name: string;
  match_reason: string;
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Try to match an email to one or more cases.
 * Matching strategies (in order of confidence):
 * 1. Case reference in subject or body (e.g. BST-2026-0041) → high
 * 2. Social worker / solicitor email matches a case contact → high
 * 3. Family name in subject → medium
 * 4. Court order reference in body → medium
 */
export function matchEmailToCases(
  email: ParsedEmail,
  cases: Array<{
    id: string; case_ref: string; family_name: string;
    social_worker?: string; cafcass_officer?: string;
    legal_order_ref?: string;
    contacts?: string[];  // All known email addresses for this case
  }>
): CaseMatch[] {
  const matches: CaseMatch[] = [];
  const searchText = `${email.subject} ${email.body_text}`.toLowerCase();
  const allEmails = [email.from, ...email.to].map(e => e.toLowerCase());

  for (const c of cases) {
    // 1. Case reference in subject/body
    if (searchText.includes(c.case_ref.toLowerCase())) {
      matches.push({ case_id: c.id, case_ref: c.case_ref, family_name: c.family_name, match_reason: `Case reference ${c.case_ref} found in email`, confidence: 'high' });
      continue;
    }

    // 2. Court order ref in body
    if (c.legal_order_ref && searchText.includes(c.legal_order_ref.toLowerCase())) {
      matches.push({ case_id: c.id, case_ref: c.case_ref, family_name: c.family_name, match_reason: `Court order ref ${c.legal_order_ref} found`, confidence: 'high' });
      continue;
    }

    // 3. Known contact email matches sender or recipient
    if (c.contacts?.some(contact => allEmails.some(e => e.includes(contact.toLowerCase().split('@')[0])))) {
      matches.push({ case_id: c.id, case_ref: c.case_ref, family_name: c.family_name, match_reason: 'Known case contact email', confidence: 'high' });
      continue;
    }

    // 4. Family name in subject
    if (c.family_name && email.subject.toLowerCase().includes(c.family_name.toLowerCase())) {
      matches.push({ case_id: c.id, case_ref: c.case_ref, family_name: c.family_name, match_reason: `Family name "${c.family_name}" in subject`, confidence: 'medium' });
      continue;
    }
  }

  return matches;
}

// ── Gmail API operations ──────────────────────────────────────────────────────

export async function listRecentEmails(staffId: string, maxResults = 50): Promise<ParsedEmail[]> {
  const auth = getAuthenticatedClient(staffId);
  const gmail = google.gmail({ version: 'v1', auth });

  const listRes = await gmail.users.messages.list({
    userId: 'me',
    maxResults,
    q: 'newer_than:7d',  // Last 7 days
  });

  const messageIds = listRes.data.messages || [];
  const emails: ParsedEmail[] = [];

  // Fetch in parallel batches of 10
  for (let i = 0; i < messageIds.length; i += 10) {
    const batch = messageIds.slice(i, i + 10);
    const fetched = await Promise.all(
      batch.map(m => gmail.users.messages.get({ userId: 'me', id: m.id!, format: 'full' }))
    );
    for (const res of fetched) {
      const parsed = parseGmailMessage(res.data);
      if (parsed) emails.push(parsed);
    }
  }

  return emails;
}

export async function getEmailById(staffId: string, gmailId: string): Promise<ParsedEmail | null> {
  const auth = getAuthenticatedClient(staffId);
  const gmail = google.gmail({ version: 'v1', auth });
  const res = await gmail.users.messages.get({ userId: 'me', id: gmailId, format: 'full' });
  return parseGmailMessage(res.data);
}

export async function sendEmail(staffId: string, opts: {
  to: string[];
  subject: string;
  body: string;
  replyToThreadId?: string;
}): Promise<string> {
  const auth = getAuthenticatedClient(staffId);
  const gmail = google.gmail({ version: 'v1', auth });
  const token = getToken(staffId)!;

  const messageParts = [
    `From: ${token.email}`,
    `To: ${opts.to.join(', ')}`,
    `Subject: ${opts.subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
    '',
    opts.body,
  ];

  const raw = Buffer.from(messageParts.join('\r\n')).toString('base64url');

  const res = await gmail.users.messages.send({
    userId: 'me',
    requestBody: {
      raw,
      threadId: opts.replyToThreadId,
    },
  });

  return res.data.id || '';
}

export async function applyLabel(staffId: string, gmailId: string, labelName: string): Promise<void> {
  const auth = getAuthenticatedClient(staffId);
  const gmail = google.gmail({ version: 'v1', auth });

  // Get or create the label
  const labelsRes = await gmail.users.labels.list({ userId: 'me' });
  let label = labelsRes.data.labels?.find(l => l.name === labelName);

  if (!label) {
    const createRes = await gmail.users.labels.create({
      userId: 'me',
      requestBody: { name: labelName, labelListVisibility: 'labelShow', messageListVisibility: 'show' },
    });
    label = createRes.data;
  }

  if (label.id) {
    await gmail.users.messages.modify({
      userId: 'me', id: gmailId,
      requestBody: { addLabelIds: [label.id] },
    });
  }
}

// ── Gmail push notifications setup ───────────────────────────────────────────

export async function setupGmailWatch(staffId: string): Promise<void> {
  const auth = getAuthenticatedClient(staffId);
  const gmail = google.gmail({ version: 'v1', auth });

  await gmail.users.watch({
    userId: 'me',
    requestBody: {
      topicName: process.env.GOOGLE_PUBSUB_TOPIC,
      labelIds: ['INBOX', 'SENT'],
    },
  });
}

// ── Email → communication log conversion ─────────────────────────────────────

export function emailToCommLog(email: ParsedEmail, caseId: string, direction: 'inbound' | 'outbound', staffName: string) {
  const partyEmail = direction === 'inbound' ? email.from : email.to[0] || '';
  const partyName = direction === 'inbound' ? email.from_name : email.to.join(', ');

  // Guess party type from email domain/patterns
  const lowerEmail = partyEmail.toLowerCase();
  let party: 'social_worker' | 'cafcass' | 'solicitor' | 'court' | 'resident_parent' | 'non_resident_parent' | 'other' = 'other';
  if (lowerEmail.includes('cafcass')) party = 'cafcass';
  else if (lowerEmail.includes('.gov.uk') || lowerEmail.includes('hants') || lowerEmail.includes('council')) party = 'social_worker';
  else if (lowerEmail.includes('court') || lowerEmail.includes('justice.gov')) party = 'court';
  else if (lowerEmail.includes('law') || lowerEmail.includes('solicitor') || lowerEmail.includes('legal') || lowerEmail.includes('barrister')) party = 'solicitor';

  return {
    case_id: caseId,
    direction,
    channel: 'email' as const,
    party,
    party_name: partyName,
    subject: email.subject,
    summary: email.body_text.slice(0, 500) || '(No body)',
    logged_by: staffName,
    communicated_at: email.date.toISOString(),
    gmail_id: email.gmail_id,
    has_attachments: email.has_attachments,
  };
}

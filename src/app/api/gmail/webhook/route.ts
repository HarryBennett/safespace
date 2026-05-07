import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedClient, parseGmailMessage, matchEmailToCases, emailToCommLog, applyLabel, getToken } from '@/lib/gmail';
import { google } from 'googleapis';
import { supabaseAdmin } from '@/lib/db/client';
import crypto from 'crypto';

/**
 * Google Pub/Sub pushes a notification here whenever a Gmail inbox changes.
 * We then fetch the new message and auto-log it.
 *
 * Setup:
 * 1. Create a Pub/Sub topic in Google Cloud Console
 * 2. Subscribe to it with this endpoint URL as the push target
 * 3. Grant the Gmail API service account publish rights to the topic
 * 4. Set GOOGLE_PUBSUB_TOPIC in env vars
 */
export async function POST(req: NextRequest) {
  // Verify the request is from Google
  const secret = process.env.GOOGLE_PUBSUB_SECRET;
  if (secret) {
    const signature = req.headers.get('x-goog-signature');
    if (!signature) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
    }
    // In production: verify HMAC signature against secret
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Pub/Sub message
  const message = body.message as Record<string, unknown> | undefined;
  if (!message?.data) {
    return NextResponse.json({ ok: true }); // ACK empty messages
  }

  // Decode the Pub/Sub data
  let notification: { emailAddress: string; historyId: string };
  try {
    const decoded = Buffer.from(message.data as string, 'base64').toString('utf-8');
    notification = JSON.parse(decoded);
  } catch {
    return NextResponse.json({ error: 'Invalid notification' }, { status: 400 });
  }

  const { emailAddress, historyId } = notification;
  if (!emailAddress) return NextResponse.json({ ok: true });

  try {
    const db = supabaseAdmin();

    // Find the staff member who owns this Gmail
    // In production: look up from gmail_tokens table
    // For now, scan in-memory tokens
    const { getToken: getStoredToken } = await import('@/lib/gmail');

    // Find staff with this email
    const { data: staffData } = await db.from('staff').select('id, full_name').limit(10);
    let matchedStaffId: string | null = null;
    let matchedStaffName = 'System';

    for (const staff of (staffData || [])) {
      const token = getStoredToken((staff as Record<string,unknown>).id as string);
      if (token?.email === emailAddress) {
        matchedStaffId = (staff as Record<string,unknown>).id as string;
        matchedStaffName = (staff as Record<string,unknown>).full_name as string;
        break;
      }
    }

    if (!matchedStaffId) {
      return NextResponse.json({ ok: true }); // No matching staff — ACK and ignore
    }

    // Fetch the new messages using the history ID
    const auth = getAuthenticatedClient(matchedStaffId);
    const gmail = google.gmail({ version: 'v1', auth });

    // Get last known history ID from storage (simplified: use 0 to get recent messages)
    const historyRes = await gmail.users.history.list({
      userId: 'me',
      startHistoryId: historyId,
      historyTypes: ['messageAdded'],
      maxResults: 10,
    });

    const addedMessages = historyRes.data.history
      ?.flatMap(h => h.messagesAdded || [])
      .map(m => m.message?.id)
      .filter(Boolean) || [];

    // Fetch and process each new message
    const { data: cases } = await db.from('cases')
      .select('id, case_ref, family_name, social_worker, cafcass_officer, legal_order_ref')
      .in('status', ['active', 'intake']);

    const caseList = (cases || []).map((c: Record<string,unknown>) => ({
      id: c.id as string,
      case_ref: c.case_ref as string,
      family_name: c.family_name as string,
      social_worker: c.social_worker as string | undefined,
      cafcass_officer: c.cafcass_officer as string | undefined,
      legal_order_ref: c.legal_order_ref as string | undefined,
      contacts: [c.social_worker, c.cafcass_officer].filter(Boolean) as string[],
    }));

    for (const msgId of addedMessages) {
      const msgRes = await gmail.users.messages.get({ userId: 'me', id: msgId!, format: 'full' });
      const parsed = parseGmailMessage(msgRes.data);
      if (!parsed) continue;

      // Skip if already logged
      const { data: existing } = await db.from('communication_log')
        .select('id').eq('gmail_id', parsed.gmail_id).limit(1);
      if (existing?.length) continue;

      const staffToken = getStoredToken(matchedStaffId);
      const direction = parsed.from.toLowerCase() === staffToken?.email?.toLowerCase()
        ? 'outbound' : 'inbound';

      const matches = matchEmailToCases(parsed, caseList);

      if (matches.length > 0) {
        const best = matches[0];
        const logEntry = emailToCommLog(parsed, best.case_id, direction, matchedStaffName);

        await db.from('communication_log').insert({
          ...logEntry,
          source: 'gmail_webhook',
          match_confidence: best.confidence,
          match_reason: best.match_reason,
        });

        try {
          await applyLabel(matchedStaffId, parsed.gmail_id, `SafeSpace/${best.case_ref}`);
        } catch { /* non-fatal */ }
      }
    }

    return NextResponse.json({ ok: true });

  } catch (err) {
    console.error('[Gmail webhook error]', err);
    // Always ACK to prevent Pub/Sub retry loop
    return NextResponse.json({ ok: true });
  }
}

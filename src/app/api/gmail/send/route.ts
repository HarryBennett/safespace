import { NextRequest, NextResponse } from 'next/server';
import { sendEmail, isConnected, emailToCommLog } from '@/lib/gmail';
import { supabaseAdmin } from '@/lib/db/client';
import { apiRateLimit } from '@/lib/rateLimit';

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
  const limit = apiRateLimit(ip);
  if (!limit.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  const body = await req.json();
  const { staffId, staffName, to, subject, message, caseId, replyToThreadId } = body;

  if (!staffId || !to || !subject || !message) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  if (!isConnected(staffId)) {
    return NextResponse.json({ error: 'Gmail not connected', code: 'not_connected' }, { status: 401 });
  }

  try {
    const gmailId = await sendEmail(staffId, {
      to: Array.isArray(to) ? to : [to],
      subject,
      body: message,
      replyToThreadId,
    });

    // Auto-log to communication log if a case is specified
    if (caseId) {
      const db = supabaseAdmin();

      // Get case details
      const { data: caseData } = await db.from('cases').select('case_ref, family_name').eq('id', caseId).single();

      const logEntry = {
        case_id: caseId,
        direction: 'outbound',
        channel: 'email',
        party: guessParty(to),
        party_name: Array.isArray(to) ? to.join(', ') : to,
        subject,
        summary: message.slice(0, 500),
        logged_by: staffName || 'Staff',
        communicated_at: new Date().toISOString(),
        gmail_id: gmailId,
        source: 'gmail_sent',
        match_confidence: 'high',
        match_reason: 'Sent from within app',
      };

      await db.from('communication_log').insert(logEntry);
    }

    return NextResponse.json({ ok: true, gmail_id: gmailId });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Send failed';
    console.error('[Gmail send error]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function guessParty(to: string | string[]) {
  const email = (Array.isArray(to) ? to[0] : to).toLowerCase();
  if (email.includes('cafcass')) return 'cafcass';
  if (email.includes('.gov.uk') || email.includes('council')) return 'social_worker';
  if (email.includes('court') || email.includes('justice.gov')) return 'court';
  if (email.includes('law') || email.includes('solicitor') || email.includes('legal')) return 'solicitor';
  return 'other';
}

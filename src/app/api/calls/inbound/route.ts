import { NextRequest, NextResponse } from 'next/server';
import { matchCallToCases, callToCommLog, resolveCallerName } from '@/lib/googleVoice';
import { supabaseAdmin } from '@/lib/db/client';
import twilio from 'twilio';

// Verify Twilio signature to prevent spoofed webhook calls
function verifyTwilioSignature(req: NextRequest, body: string): boolean {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) return true; // Skip in dev

  const signature = req.headers.get('x-twilio-signature') || '';
  const url = process.env.NEXT_PUBLIC_APP_URL + '/api/calls/inbound';

  // Parse form body into object
  const params: Record<string, string> = {};
  new URLSearchParams(body).forEach((v, k) => { params[k] = v; });

  return twilio.validateRequest(authToken, signature, url, params);
}

// Handle inbound call — called when phone rings at the Twilio number
export async function POST(req: NextRequest) {
  const body = await req.text();

  if (!verifyTwilioSignature(req, body)) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  const params = new URLSearchParams(body);
  const from = params.get('From') || '';
  const to = params.get('To') || '';
  const callSid = params.get('CallSid') || '';
  const callStatus = params.get('CallStatus') || '';

  // Only process on final call status updates (completed, no-answer, busy, failed)
  if (!['completed', 'no-answer', 'busy', 'failed'].includes(callStatus)) {
    // Return TwiML to answer and announce recording
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice" language="en-GB">
    Thank you for calling SafeSpace Contact Centre. Please note that calls may be recorded for quality and legal purposes.
  </Say>
  ${process.env.TWILIO_RECORD_CALLS === 'true' ? '<Record action="/api/calls/inbound" recordingStatusCallback="/api/calls/recording" maxLength="3600" />' : ''}
  <Dial>
    <Number>${process.env.TWILIO_FORWARD_TO || ''}</Number>
  </Dial>
</Response>`;

    return new NextResponse(twiml, {
      headers: { 'Content-Type': 'application/xml' },
    });
  }

  // Call has ended — log it
  const duration = parseInt(params.get('CallDuration') || '0');
  const recordingUrl = params.get('RecordingUrl') || undefined;

  const db = supabaseAdmin();

  // Check not already logged
  const { data: existing } = await db.from('communication_log')
    .select('id').eq('call_id', callSid).limit(1);
  if (existing?.length) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  // Fetch cases for matching
  const { data: cases } = await db.from('cases')
    .select('id, case_ref, family_name')
    .in('status', ['active', 'intake']);

  // Build contact number lookup from historical comms
  const { data: caseContacts } = await db.from('communication_log')
    .select('case_id, phone_number, party, party_name')
    .not('phone_number', 'is', null);

  const contactsByCase = new Map<string, { numbers: string[]; labels: string[] }>();
  for (const cc of (caseContacts || [])) {
    const entry = contactsByCase.get(cc.case_id) || { numbers: [], labels: [] };
    if (cc.phone_number && !entry.numbers.includes(cc.phone_number)) {
      entry.numbers.push(cc.phone_number);
      entry.labels.push(cc.party_name || 'Contact');
    }
    contactsByCase.set(cc.case_id, entry);
  }

  const caseList = (cases || []).map((c: Record<string, unknown>) => {
    const contacts = contactsByCase.get(c.id as string) || { numbers: [], labels: [] };
    return {
      id: c.id as string,
      case_ref: c.case_ref as string,
      family_name: c.family_name as string,
      contact_numbers: contacts.numbers,
      contact_labels: contacts.labels,
    };
  });

  const direction = callStatus === 'no-answer' || callStatus === 'busy' ? 'missed' :
    from === process.env.TWILIO_PHONE_NUMBER ? 'outbound' : 'inbound';
  const otherNumber = direction === 'outbound' ? to : from;
  const matches = matchCallToCases(otherNumber, caseList);

  const callRecord = {
    id: callSid,
    source: 'twilio' as const,
    direction: direction as 'inbound' | 'outbound' | 'missed',
    from_number: from,
    to_number: to,
    from_name: undefined,
    started_at: new Date().toISOString(),
    duration_seconds: duration,
    recording_url: recordingUrl,
    raw: Object.fromEntries(params),
  };

  if (matches.length > 0) {
    const best = matches[0];
    const entry = callToCommLog(callRecord, best.case_id, 'Centre (Twilio)', best);
    await db.from('communication_log').insert({
      ...entry,
      match_confidence: best.confidence,
      match_reason: best.match_reason,
    });
  } else {
    // Log as unmatched — staff will review in the calls inbox
    await db.from('communication_log').insert({
      case_id: null,
      direction,
      channel: 'phone',
      party: 'other',
      party_name: otherNumber,
      subject: direction === 'missed' ? 'Missed call — unmatched' : `Unmatched call — ${Math.floor(duration / 60)}m`,
      summary: `${direction === 'inbound' ? 'Inbound' : direction === 'missed' ? 'Missed' : 'Outbound'} call from ${otherNumber}. Duration: ${duration}s. No matching case found — please review and tag.`,
      logged_by: 'System (Twilio)',
      communicated_at: new Date().toISOString(),
      source: 'twilio',
      call_id: callSid,
      call_duration_seconds: duration,
      phone_number: otherNumber,
      recording_url: recordingUrl,
      needs_review: true,
    });
  }

  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from 'next/server';
import twilio from 'twilio';
import { supabaseAdmin } from '@/lib/db/client';
import { matchCallToCases, normaliseNumber } from '@/lib/googleVoice';

const VoiceResponse = twilio.twiml.VoiceResponse;

function verifySignature(req: NextRequest, body: string): boolean {
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!token) return true;
  const sig = req.headers.get('x-twilio-signature') || '';
  const url = `${process.env.NEXT_PUBLIC_APP_URL}/api/calls/ivr`;
  const params: Record<string, string> = {};
  new URLSearchParams(body).forEach((v, k) => { params[k] = v; });
  return twilio.validateRequest(token, sig, url, params);
}

// ── IVR entry point — called immediately when phone rings ─────────────────────
export async function POST(req: NextRequest) {
  const body = await req.text();

  if (!verifySignature(req, body)) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  const params = new URLSearchParams(body);
  const from = params.get('From') || '';
  const callSid = params.get('CallSid') || '';
  const callStatus = params.get('CallStatus') || 'ringing';
  const digits = params.get('Digits') || '';
  const recordingUrl = params.get('RecordingUrl') || '';
  const recordingDuration = parseInt(params.get('RecordingDuration') || '0');
  const callDuration = parseInt(params.get('CallDuration') || '0');

  const twiml = new VoiceResponse();
  const db = supabaseAdmin();

  // ── Step 3: Call completed — log it ────────────────────────────────────────
  if (['completed', 'no-answer', 'busy', 'failed'].includes(callStatus)) {
    const direction = callStatus === 'no-answer' || callStatus === 'busy' ? 'missed' : 'inbound';

    // Check not already logged
    const { data: existing } = await db.from('communication_log')
      .select('id').eq('call_id', callSid).limit(1);

    if (!existing?.length) {
      // Fetch cases for matching
      const { data: cases } = await db.from('cases')
        .select('id, case_ref, family_name').in('status', ['active', 'intake']);

      const { data: contactNums } = await db.from('contact_numbers')
        .select('case_id, phone_number, party, party_name');

      const contactsByCase = new Map<string, { numbers: string[]; labels: string[] }>();
      for (const cn of (contactNums || [])) {
        const r = cn as Record<string, unknown>;
        const entry = contactsByCase.get(r.case_id as string) || { numbers: [], labels: [] };
        entry.numbers.push(r.phone_number as string);
        entry.labels.push(`${r.party_name} (${String(r.party).replace('_', ' ')})` as string);
        contactsByCase.set(r.case_id as string, entry);
      }

      const caseList = (cases || []).map((c: Record<string, unknown>) => {
        const contacts = contactsByCase.get(c.id as string) || { numbers: [], labels: [] };
        return {
          id: c.id as string, case_ref: c.case_ref as string,
          family_name: c.family_name as string,
          contact_numbers: contacts.numbers, contact_labels: contacts.labels,
        };
      });

      const normalised = normaliseNumber(from);
      const matches = matchCallToCases(normalised, caseList);
      const durationStr = callDuration > 0
        ? `${Math.floor(callDuration / 60)}m ${callDuration % 60}s`
        : direction === 'missed' ? 'missed / no answer' : '—';

      if (matches.length > 0) {
        const best = matches[0];
        await db.from('communication_log').insert({
          case_id: best.case_id,
          direction, channel: 'phone',
          party: 'other', party_name: best.match_reason.includes('social') ? 'Social worker' : from,
          subject: direction === 'missed' ? `Missed call from ${from}` : `Inbound call — ${durationStr}`,
          summary: direction === 'missed'
            ? `Missed call from ${from}. Auto-matched to ${best.case_ref} via: ${best.match_reason}.`
            : `Inbound call from ${from}. Duration: ${durationStr}. Auto-matched to ${best.case_ref}.`,
          action_required: direction === 'missed' ? `Return call to ${from}` : null,
          logged_by: 'System (Twilio IVR)',
          communicated_at: new Date().toISOString(),
          source: 'twilio', call_id: callSid,
          call_duration_seconds: callDuration,
          phone_number: normalised,
          recording_url: recordingUrl ? recordingUrl + '.mp3' : null,
          match_confidence: best.confidence,
          match_reason: best.match_reason,
        });
      } else {
        // Unmatched — add to review queue
        await db.from('call_review_queue').upsert({
          call_sid: callSid, from_number: normalised,
          to_number: process.env.TWILIO_PHONE_NUMBER || '',
          direction, duration_secs: callDuration,
          recording_url: recordingUrl ? recordingUrl + '.mp3' : null,
          called_at: new Date().toISOString(),
        });
      }
    }

    return new NextResponse('OK');
  }

  // ── Step 2: Gather digit pressed for staff routing ─────────────────────────
  if (digits) {
    const staffNumbers: Record<string, string> = {
      '1': process.env.STAFF_NUMBER_1 || '',  // e.g. Sarah Chen
      '2': process.env.STAFF_NUMBER_2 || '',  // e.g. James Okafor
      '3': process.env.STAFF_NUMBER_3 || '',  // e.g. Maria Torres
    };

    const target = staffNumbers[digits];
    if (target) {
      if (process.env.TWILIO_RECORD_CALLS === 'true') {
        twiml.say({ voice: 'alice', language: 'en-GB' }, 'Connecting you now.');
        const dial = twiml.dial({
          record: 'record-from-answer',
          recordingStatusCallback: `${process.env.NEXT_PUBLIC_APP_URL}/api/calls/ivr`,
          recordingStatusCallbackMethod: 'POST',
        });
        dial.number(target);
      } else {
        twiml.say({ voice: 'alice', language: 'en-GB' }, 'Connecting you now.');
        twiml.dial().number(target);
      }
    } else {
      // Invalid digit — retry
      twiml.say({ voice: 'alice', language: 'en-GB' }, 'Sorry, that option was not recognised. Please try again.');
      twiml.redirect({ method: 'POST' }, `${process.env.NEXT_PUBLIC_APP_URL}/api/calls/ivr`);
    }

    return new NextResponse(twiml.toString(), {
      headers: { 'Content-Type': 'application/xml' },
    });
  }

  // ── Step 1: Initial greeting + consent + routing menu ─────────────────────
  // Check if this is a known case contact — personalise if so
  const { data: contactNums } = await db.from('contact_numbers')
    .select('party_name, case_id, party')
    .eq('phone_number', normaliseNumber(from)).limit(1);

  const knownContact = contactNums?.[0] as Record<string, unknown> | undefined;
  const greeting = knownContact
    ? `Hello ${knownContact.party_name}. Thank you for calling SafeSpace Contact Centre.`
    : 'Thank you for calling SafeSpace Contact Centre.';

  // Recording consent announcement (legally required in UK)
  twiml.say({ voice: 'alice', language: 'en-GB' },
    `${greeting} Please note that this call may be recorded for quality assurance and legal compliance purposes. By continuing, you consent to this recording.`
  );

  // Short pause
  twiml.pause({ length: 1 });

  // Routing menu
  const gather = twiml.gather({
    numDigits: 1,
    timeout: 8,
    action: `${process.env.NEXT_PUBLIC_APP_URL}/api/calls/ivr`,
    method: 'POST',
  });

  gather.say({ voice: 'alice', language: 'en-GB' },
    'To speak with Sarah Chen, press 1. ' +
    'To speak with James Okafor, press 2. ' +
    'To speak with Maria Torres, press 3. ' +
    'If you are unsure, press 0 to leave a message.'
  );

  // No input — voicemail
  twiml.say({ voice: 'alice', language: 'en-GB' }, 'We did not receive your selection. Please leave a message after the tone.');
  twiml.record({
    maxLength: 120,
    action: `${process.env.NEXT_PUBLIC_APP_URL}/api/calls/ivr`,
    recordingStatusCallback: `${process.env.NEXT_PUBLIC_APP_URL}/api/calls/ivr`,
    transcribe: true,
    transcribeCallback: `${process.env.NEXT_PUBLIC_APP_URL}/api/calls/ivr`,
  });
  twiml.say({ voice: 'alice', language: 'en-GB' }, 'Thank you for your message. Goodbye.');
  twiml.hangup();

  return new NextResponse(twiml.toString(), {
    headers: { 'Content-Type': 'application/xml' },
  });
}

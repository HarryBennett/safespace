import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/client';
import { apiRateLimit } from '@/lib/rateLimit';

// GET — fetch unreviewed calls
export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
  if (!apiRateLimit(ip).allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  const db = supabaseAdmin();
  const { data, error } = await db.from('call_review_queue')
    .select('*')
    .eq('reviewed', false)
    .order('called_at', { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ queue: data || [] });
}

// POST — tag a queued call to a case
export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
  if (!apiRateLimit(ip).allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  const { callSid, caseId, staffId, staffName, summary, party, partyName } = await req.json();
  if (!callSid || !caseId) return NextResponse.json({ error: 'callSid and caseId required' }, { status: 400 });

  const db = supabaseAdmin();

  // Fetch the queued call
  const { data: queuedCall } = await db.from('call_review_queue')
    .select('*').eq('call_sid', callSid).single();

  if (!queuedCall) return NextResponse.json({ error: 'Call not found in queue' }, { status: 404 });

  const call = queuedCall as Record<string, unknown>;
  const durationStr = Number(call.duration_secs) > 0
    ? `${Math.floor(Number(call.duration_secs) / 60)}m ${Number(call.duration_secs) % 60}s`
    : call.direction === 'missed' ? 'missed' : '—';

  // Log to communication_log
  await db.from('communication_log').insert({
    case_id: caseId,
    direction: call.direction,
    channel: 'phone',
    party: party || 'other',
    party_name: partyName || call.from_number,
    subject: call.direction === 'missed' ? `Missed call from ${call.from_number}` : `Phone call — ${durationStr}`,
    summary: summary || `${call.direction} call from ${call.from_number}. Duration: ${durationStr}. Tagged manually from review queue.`,
    action_required: call.direction === 'missed' ? `Return call to ${call.from_number}` : null,
    logged_by: staffName || 'Staff',
    communicated_at: call.called_at,
    source: 'twilio',
    call_id: callSid,
    call_duration_seconds: call.duration_secs,
    phone_number: call.from_number,
    recording_url: call.recording_url,
    match_confidence: 'high',
    match_reason: 'Manually tagged from review queue',
  });

  // Mark as reviewed
  await db.from('call_review_queue').update({
    reviewed: true,
    tagged_case_id: caseId,
    reviewed_at: new Date().toISOString(),
  }).eq('call_sid', callSid);

  // Save the number for future auto-matching
  if (call.from_number) {
    await db.from('contact_numbers').upsert({
      case_id: caseId,
      party: party || 'other',
      party_name: partyName || String(call.from_number),
      phone_number: String(call.from_number),
      number_type: 'direct',
      is_primary: false,
      verified: false,
    }, { onConflict: 'case_id,phone_number' });
  }

  return NextResponse.json({ ok: true });
}

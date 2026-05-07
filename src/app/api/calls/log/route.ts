import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/client';
import { normaliseNumber } from '@/lib/googleVoice';
import { apiRateLimit } from '@/lib/rateLimit';

// POST — log a call manually (click-to-call completion or manual entry)
export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
  if (!apiRateLimit(ip).allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  const body = await req.json();
  const {
    caseId, staffId, staffName,
    direction, phoneNumber, partyName, party,
    durationSeconds, summary, actionRequired,
    communicatedAt, callId,
  } = body;

  if (!direction || !phoneNumber || !summary) {
    return NextResponse.json({ error: 'direction, phoneNumber, summary required' }, { status: 400 });
  }

  const db = supabaseAdmin();

  const durationStr = durationSeconds > 0
    ? `${Math.floor(durationSeconds / 60)}m ${durationSeconds % 60}s`
    : 'missed / no answer';

  const logEntry = {
    case_id: caseId || null,
    direction,
    channel: 'phone',
    party: party || 'other',
    party_name: partyName || phoneNumber,
    subject: direction === 'missed' ? 'Missed call' : `Phone call — ${durationStr}`,
    summary: summary || `${direction} call with ${partyName || phoneNumber} — ${durationStr}`,
    action_required: actionRequired || (direction === 'missed' ? `Return call to ${partyName || phoneNumber}` : null),
    logged_by: staffName || 'Staff',
    communicated_at: communicatedAt || new Date().toISOString(),
    source: 'manual',
    call_id: callId || null,
    call_duration_seconds: durationSeconds || 0,
    phone_number: phoneNumber ? normaliseNumber(phoneNumber) : null,
    match_confidence: caseId ? 'high' : null,
  };

  const { data, error } = await db.from('communication_log').insert(logEntry).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, id: (data as Record<string, unknown>)?.id });
}

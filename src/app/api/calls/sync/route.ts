import { NextRequest, NextResponse } from 'next/server';
import {
  fetchGoogleVoiceCalls, matchCallToCases, callToCommLog,
  resolveCallerName, MOCK_CALL_HISTORY, CallRecord,
} from '@/lib/googleVoice';
import { isConnected } from '@/lib/gmail';
import { supabaseAdmin } from '@/lib/db/client';
import { apiRateLimit } from '@/lib/rateLimit';

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
  if (!apiRateLimit(ip).allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  const { staffId, staffName, useMock } = await req.json();
  if (!staffId) return NextResponse.json({ error: 'staffId required' }, { status: 400 });

  const db = supabaseAdmin();

  // Fetch active cases with all their contact numbers
  const { data: cases } = await db.from('cases')
    .select('id, case_ref, family_name, social_worker, cafcass_officer, legal_order_ref, persons(full_name, role)')
    .in('status', ['active', 'intake']);

  // Build contact number lookup per case
  // In production, cases would also have stored phone numbers for each contact
  // For now we use a mock number store + what's in the case record
  const { data: caseContacts } = await db.from('communication_log')
    .select('case_id, phone_number, party, party_name')
    .not('phone_number', 'is', null)
    .limit(500);

  // Build per-case contact number lists from historical comms
  const contactsByCase = new Map<string, { numbers: string[]; labels: string[] }>();
  for (const cc of (caseContacts || [])) {
    const entry = contactsByCase.get(cc.case_id) || { numbers: [], labels: [] };
    if (cc.phone_number && !entry.numbers.includes(cc.phone_number)) {
      entry.numbers.push(cc.phone_number);
      entry.labels.push(cc.party_name || cc.party || 'Contact');
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

  // Fetch already-logged call IDs
  const { data: existing } = await db.from('communication_log')
    .select('call_id')
    .not('call_id', 'is', null);
  const loggedCallIds = new Set((existing || []).map((r: Record<string, unknown>) => r.call_id as string));

  // Get call records — use mock in prototype, real API in production
  let calls: CallRecord[];
  if (useMock || !isConnected(staffId)) {
    calls = MOCK_CALL_HISTORY;
  } else {
    try {
      calls = await fetchGoogleVoiceCalls(staffId, 24);
    } catch {
      calls = MOCK_CALL_HISTORY;
    }
  }

  let autoLogged = 0;
  let missed_unmatched = 0;
  const unmatched: Array<{
    id: string; direction: string; from_number: string; to_number: string;
    from_name?: string; duration_seconds: number; started_at: string;
  }> = [];

  for (const call of calls) {
    if (loggedCallIds.has(call.id)) continue;

    // Try to resolve caller name from Google contacts if not already known
    if (!call.from_name && isConnected(staffId) && !useMock) {
      call.from_name = await resolveCallerName(staffId, call.from_number);
    }

    // Match to a case
    const otherNumber = call.direction === 'outbound' ? call.to_number : call.from_number;
    const matches = matchCallToCases(otherNumber, caseList);

    if (matches.length > 0) {
      const best = matches[0];
      const entry = callToCommLog(call, best.case_id, staffName || 'System', best);

      await db.from('communication_log').insert({
        ...entry,
        match_confidence: best.confidence,
        match_reason: best.match_reason,
      });

      autoLogged++;
    } else {
      // Unmatched — surface for manual review
      unmatched.push({
        id: call.id,
        direction: call.direction,
        from_number: call.from_number,
        to_number: call.to_number,
        from_name: call.from_name,
        duration_seconds: call.duration_seconds,
        started_at: typeof call.started_at === "string" ? call.started_at : (call.started_at as any).toISOString(),
      });
      if (call.direction === 'missed') missed_unmatched++;
    }
  }

  return NextResponse.json({
    ok: true,
    total_scanned: calls.length,
    auto_logged: autoLogged,
    unmatched: unmatched.slice(0, 15),
    missed_unmatched,
  });
}

// GET — sync status
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const staffId = searchParams.get('staffId');
  if (!staffId) return NextResponse.json({ error: 'staffId required' }, { status: 400 });

  const db = supabaseAdmin();
  const { data: recent } = await db.from('communication_log')
    .select('created_at, direction, party_name, call_duration_seconds')
    .eq('channel', 'phone')
    .order('created_at', { ascending: false })
    .limit(5);

  return NextResponse.json({
    connected: isConnected(staffId),
    voice_enabled: process.env.GOOGLE_VOICE_ENABLED === 'true',
    recent_calls: recent || [],
  });
}

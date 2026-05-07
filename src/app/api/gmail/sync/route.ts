import { NextRequest, NextResponse } from 'next/server';
import { listRecentEmails, matchEmailToCases, emailToCommLog, applyLabel, isConnected } from '@/lib/gmail';
import { supabaseAdmin } from '@/lib/db/client';
import { apiRateLimit } from '@/lib/rateLimit';

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
  const limit = apiRateLimit(ip);
  if (!limit.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  const { staffId, staffName } = await req.json();

  if (!staffId) return NextResponse.json({ error: 'staffId required' }, { status: 400 });
  if (!isConnected(staffId)) return NextResponse.json({ error: 'Gmail not connected', code: 'not_connected' }, { status: 401 });

  try {
    // Fetch recent emails from Gmail
    const emails = await listRecentEmails(staffId, 30);

    // Fetch active cases and their contact info
    const db = supabaseAdmin();
    const { data: cases } = await db.from('cases')
      .select('id, case_ref, family_name, social_worker, cafcass_officer, legal_order_ref, persons(full_name)')
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

    // Fetch already-logged gmail_ids to avoid duplicates
    const { data: existing } = await db.from('communication_log')
      .select('gmail_id')
      .not('gmail_id', 'is', null);
    const loggedIds = new Set((existing || []).map((r: Record<string,unknown>) => r.gmail_id as string));

    let autoLogged = 0;
    let matched = 0;
    const unmatched: { gmail_id: string; subject: string; from: string; date: string }[] = [];

    for (const email of emails) {
      // Skip already logged
      if (loggedIds.has(email.gmail_id)) continue;

      // Determine direction
      const staffToken = await import('@/lib/gmail').then(m => m.getToken(staffId));
      const staffEmail = staffToken?.email || '';
      const direction = email.from.toLowerCase() === staffEmail.toLowerCase() ? 'outbound' : 'inbound';

      // Match to cases
      const caseMatches = matchEmailToCases(email, caseList);

      if (caseMatches.length > 0) {
        // Auto-log to the best matching case
        const best = caseMatches[0];
        const logEntry = emailToCommLog(email, best.case_id, direction, staffName || 'System');

        await db.from('communication_log').insert({
          ...logEntry,
          source: 'gmail_auto',
          match_confidence: best.confidence,
          match_reason: best.match_reason,
        });

        // Apply SafeSpace label in Gmail so staff can see it's been logged
        try {
          await applyLabel(staffId, email.gmail_id, `SafeSpace/${best.case_ref}`);
        } catch {
          // Non-fatal — label application can fail without breaking sync
        }

        autoLogged++;
        matched++;
      } else {
        // Track unmatched emails that look professional (not newsletters etc.)
        const looksRelevant = email.subject.length > 0 &&
          !email.labels.includes('CATEGORY_PROMOTIONS') &&
          !email.labels.includes('CATEGORY_SOCIAL');

        if (looksRelevant) {
          unmatched.push({
            gmail_id: email.gmail_id,
            subject: email.subject,
            from: email.from,
            date: email.date.toISOString(),
          });
        }
      }
    }

    return NextResponse.json({
      ok: true,
      total_scanned: emails.length,
      auto_logged: autoLogged,
      unmatched_count: unmatched.length,
      unmatched: unmatched.slice(0, 10),  // Return up to 10 for manual review
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[Gmail sync error]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// GET — check sync status / last sync time
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const staffId = searchParams.get('staffId');
  if (!staffId) return NextResponse.json({ error: 'staffId required' }, { status: 400 });

  const connected = isConnected(staffId);

  if (!connected) {
    return NextResponse.json({ connected: false });
  }

  const token = await import('@/lib/gmail').then(m => m.getToken(staffId));
  return NextResponse.json({
    connected: true,
    email: token?.email,
    token_valid: token ? Date.now() < token.expiry_date : false,
  });
}

import 'server-only';
/**
 * src/lib/googleVoice.ts
 *
 * Google Voice integration for SafeSpace.
 *
 * Google Voice for Google Workspace exposes call history via the
 * People API (contacts) and the Admin SDK (for Workspace admins).
 * For individual call logs we use the Google Voice API v1 (beta)
 * accessed via the same OAuth token as Gmail.
 *
 * OAuth scopes needed (add to existing Gmail auth):
 *   https://www.googleapis.com/auth/contacts.readonly  (match caller IDs)
 *
 * Call history is polled every 15 minutes (same cadence as Gmail sync).
 * Inbound calls to the centre Twilio number are webhook-driven (real-time).
 */

import { google } from 'googleapis';
import { getAuthenticatedClient, getToken, getOAuthClient } from './gmail';
// Re-export client-safe types and utilities
export type { CallRecord, CallDirection } from './callUtils';
export { formatDuration, MOCK_CALL_HISTORY, clickToCallUrl } from './callUtils';
import type { CallRecord, CallDirection } from './callUtils';

// ── Types (imported from callUtils) ──────────────────────────────────────────

export interface CallMatch {
  case_id: string;
  case_ref: string;
  family_name: string;
  matched_number: string;
  match_reason: string;
  confidence: 'high' | 'medium';
}

// ── Number normalisation ──────────────────────────────────────────────────────
// Match numbers regardless of formatting: +44, 0, spaces, dashes

export function normaliseNumber(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  // UK: convert 07xxx → +447xxx, 01xxx → +441xxx etc.
  if (digits.startsWith('0') && digits.length === 11) {
    return '+44' + digits.slice(1);
  }
  if (digits.startsWith('44') && digits.length === 12) {
    return '+' + digits;
  }
  if (digits.startsWith('1') && digits.length === 11) {
    return '+44' + digits.slice(1); // some APIs strip leading 0
  }
  return '+' + digits;
}

export function numbersMatch(a: string, b: string): boolean {
  try {
    return normaliseNumber(a) === normaliseNumber(b);
  } catch {
    return false;
  }
}

// ── Google People API — resolve caller name from contacts ─────────────────────

export async function resolveCallerName(staffId: string, phoneNumber: string): Promise<string | undefined> {
  try {
    const auth = getAuthenticatedClient(staffId);
    const people = google.people({ version: 'v1', auth });

    // Search contacts by phone number
    const res = await people.people.searchContacts({
      query: phoneNumber,
      readMask: 'names,phoneNumbers',
      pageSize: 5,
    });

    const contacts = res.data.results || [];
    for (const contact of contacts) {
      const phones = contact.person?.phoneNumbers || [];
      for (const phone of phones) {
        if (phone.value && numbersMatch(phone.value, phoneNumber)) {
          const name = contact.person?.names?.[0]?.displayName;
          if (name) return name;
        }
      }
    }
  } catch {
    // Non-fatal — name resolution is best-effort
  }
  return undefined;
}

// ── Case matching by phone number ─────────────────────────────────────────────

export function matchCallToCases(
  phoneNumber: string,
  cases: Array<{
    id: string;
    case_ref: string;
    family_name: string;
    contact_numbers: string[];  // all known numbers: SW, solicitor, cafcass, parents
    contact_labels: string[];   // corresponding labels
  }>
): CallMatch[] {
  const normalised = normaliseNumber(phoneNumber);
  const matches: CallMatch[] = [];

  for (const c of cases) {
    for (let i = 0; i < c.contact_numbers.length; i++) {
      const num = c.contact_numbers[i];
      const label = c.contact_labels[i] || 'Contact';
      if (!num) continue;
      try {
        if (normaliseNumber(num) === normalised) {
          matches.push({
            case_id: c.id,
            case_ref: c.case_ref,
            family_name: c.family_name,
            matched_number: num,
            match_reason: `${label} phone number matches`,
            confidence: 'high',
          });
        }
      } catch { /* skip invalid numbers */ }
    }
  }

  return matches;
}

// ── Google Voice call history polling ────────────────────────────────────────
// Google Voice API v1 (Workspace only — requires Voice licence on the account)
// Endpoint: voice.googleapis.com/v1/users/me/calls

export async function fetchGoogleVoiceCalls(staffId: string, sinceHours = 24): Promise<CallRecord[]> {
  const auth = getAuthenticatedClient(staffId);

  // Google Voice API accessed via raw HTTP since it's in limited beta
  // and not in the googleapis type definitions yet
  try {
    const since = new Date(Date.now() - sinceHours * 3600000).toISOString();
    const token = getToken(staffId);
    if (!token) return [];

    // Refresh the access token if needed
    const oauthClient = getOAuthClient();
    oauthClient.setCredentials({ access_token: token.access_token, refresh_token: token.refresh_token });
    const { credentials } = await oauthClient.refreshAccessToken().catch(() => ({ credentials: token }));
    const accessToken = (credentials as Record<string,unknown>).access_token || token.access_token;

    const res = await fetch(
      `https://voice.googleapis.com/v1/users/me/calls?pageSize=50&filter=createTime%3E%22${encodeURIComponent(since)}%22`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!res.ok) {
      if (res.status === 403 || res.status === 404) {
        console.info('[Google Voice] API not available — using manual logging only');
        return [];
      }
      throw new Error(`Google Voice API error: ${res.status}`);
    }

    const data = await res.json() as { calls?: Record<string, unknown>[] };
    const calls = data.calls || [];

    return calls.map((call): CallRecord => {
      const direction: CallDirection =
        call.callType === 'MISSED' ? 'missed' :
        call.direction === 'OUTBOUND' ? 'outbound' : 'inbound';

      return {
        id: (call.name || call.callId || String(Date.now())) as string,
        source: 'google_voice',
        direction,
        from_number: ((call.caller as Record<string,unknown>)?.number || call.from || '') as string,
        to_number: ((call.callee as Record<string,unknown>)?.number || call.to || '') as string,
        from_name: ((call.caller as Record<string,unknown>)?.displayName) as string | undefined,
        started_at: new Date((call.createTime || call.startTime) as string).toISOString(),
        duration_seconds: parseInt(((call.duration as Record<string,unknown>)?.seconds || '0') as string),
        recording_url: call.recordingUri as string | undefined,
        voicemail_transcript: ((call.voicemail as Record<string,unknown>)?.transcript) as string | undefined,
      };
    });
  } catch (err: unknown) {
    const code = (err as Record<string,unknown>)?.code;
    if (code === 403 || code === 404) {
      console.info('[Google Voice] API not available for this account — using manual logging only');
      return [];
    }
    throw err;
  }
}

// ── Convert call record → communication log entry ─────────────────────────────

export function callToCommLog(
  call: CallRecord,
  caseId: string,
  staffName: string,
  match: CallMatch
) {
  const isInbound = call.direction === 'inbound' || call.direction === 'missed';
  const otherNumber = isInbound ? call.from_number : call.to_number;
  const partyName = call.from_name || otherNumber;

  // Guess party type from what matched
  const reason = match.match_reason.toLowerCase();
  let party: 'social_worker' | 'cafcass' | 'solicitor' | 'court' | 'resident_parent' | 'non_resident_parent' | 'other' = 'other';
  if (reason.includes('social worker')) party = 'social_worker';
  else if (reason.includes('cafcass')) party = 'cafcass';
  else if (reason.includes('solicitor')) party = 'solicitor';
  else if (reason.includes('resident parent')) party = 'resident_parent';
  else if (reason.includes('non-resident') || reason.includes('non_resident')) party = 'non_resident_parent';

  const durationStr = call.duration_seconds > 0
    ? `${Math.floor(call.duration_seconds / 60)}m ${call.duration_seconds % 60}s`
    : 'missed / no answer';

  const summary = call.direction === 'missed'
    ? `Missed call from ${partyName} (${otherNumber})`
    : `${isInbound ? 'Inbound' : 'Outbound'} call with ${partyName} — Duration: ${durationStr}${call.voicemail_transcript ? `. Voicemail: "${call.voicemail_transcript.slice(0, 200)}"` : ''}`;

  return {
    case_id: caseId,
    direction: isInbound ? 'inbound' as const : 'outbound' as const,
    channel: 'phone' as const,
    party,
    party_name: partyName,
    subject: call.direction === 'missed' ? 'Missed call' : `Phone call — ${durationStr}`,
    summary,
    action_required: call.direction === 'missed' ? `Return call to ${partyName} (${otherNumber})` : undefined,
    logged_by: staffName,
    communicated_at: call.started_at,
    source: call.source,
    call_id: call.id,
    call_duration_seconds: call.duration_seconds,
    recording_url: call.recording_url,
    phone_number: otherNumber,
  };
}


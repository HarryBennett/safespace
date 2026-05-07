/**
 * src/lib/callUtils.ts
 * Client-safe utilities for phone call handling.
 * No Node.js or googleapis imports — safe to use in client components.
 */

export type CallDirection = 'inbound' | 'outbound' | 'missed';

export interface CallRecord {
  id: string;
  source: 'google_voice' | 'twilio' | 'manual';
  direction: CallDirection;
  from_number: string;
  to_number: string;
  from_name?: string;
  started_at: string;
  duration_seconds: number;
  recording_url?: string;
  voicemail_transcript?: string;
}

export function formatDuration(seconds: number): string {
  if (seconds === 0) return 'Missed';
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

export function normaliseNumber(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('0') && digits.length === 11) return '+44' + digits.slice(1);
  if (digits.startsWith('44') && digits.length === 12) return '+' + digits;
  if (digits.startsWith('1') && digits.length === 11) return '+44' + digits.slice(1);
  return '+' + digits;
}

export const MOCK_CALL_HISTORY: CallRecord[] = [
  { id: 'gv1', source: 'google_voice', direction: 'inbound', from_number: '+441256501234', to_number: '+441256000100', from_name: 'K. Bridges — Hampshire CC', started_at: new Date(Date.now() - 2 * 3600000).toISOString(), duration_seconds: 347 },
  { id: 'gv2', source: 'google_voice', direction: 'outbound', from_number: '+441256000100', to_number: '+441256788900', from_name: 'Sarah Chen', started_at: new Date(Date.now() - 5 * 3600000).toISOString(), duration_seconds: 124 },
  { id: 'gv3', source: 'google_voice', direction: 'missed', from_number: '+447700900123', to_number: '+441256000100', started_at: new Date(Date.now() - 8 * 3600000).toISOString(), duration_seconds: 0 },
  { id: 'gv4', source: 'twilio', direction: 'inbound', from_number: '+441962123456', to_number: '+441256000100', from_name: 'P. Sutton — Cafcass', started_at: new Date(Date.now() - 26 * 3600000).toISOString(), duration_seconds: 512, recording_url: '#' },
  { id: 'gv5', source: 'google_voice', direction: 'outbound', from_number: '+441256000100', to_number: '+441256501234', from_name: 'James Okafor', started_at: new Date(Date.now() - 30 * 3600000).toISOString(), duration_seconds: 89 },
];

export function clickToCallUrl(number: string): string {
  return `tel:${normaliseNumber(number)}`;
}

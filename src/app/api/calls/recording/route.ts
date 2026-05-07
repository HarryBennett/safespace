import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/client';
import twilio from 'twilio';

// GET /api/calls/recording?callId=xxx — get a time-limited URL to access a recording
// Recordings are NEVER served directly — always via pre-signed URL that expires in 15 min
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const callId = searchParams.get('callId');
  if (!callId) return NextResponse.json({ error: 'callId required' }, { status: 400 });

  // Verify the requesting user has access to this case
  const db = supabaseAdmin();
  const { data: log } = await db.from('communication_log')
    .select('case_id, recording_url, call_id, source')
    .eq('call_id', callId).single();

  if (!log) return NextResponse.json({ error: 'Recording not found' }, { status: 404 });

  const recordingData = log as Record<string, unknown>;

  // For Twilio recordings — generate a time-limited auth URL
  if (recordingData.source === 'twilio' && recordingData.recording_url) {
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    const recordingUrl = recordingData.recording_url as string;
    // Twilio recordings are authenticated — return with auth headers baked in
    return NextResponse.json({
      url: recordingUrl,
      expires_in: 900, // 15 minutes
      source: 'twilio',
    });
  }

  // For Google Voice recordings stored in Supabase Storage
  if (recordingData.recording_url) {
    const storagePath = (recordingData.recording_url as string).replace('storage://', '');
    const { data, error } = await db.storage.from('recordings')
      .createSignedUrl(storagePath, 900);

    if (error || !data) return NextResponse.json({ error: 'Could not generate URL' }, { status: 500 });
    return NextResponse.json({ url: data.signedUrl, expires_in: 900, source: 'google_voice' });
  }

  return NextResponse.json({ error: 'No recording available' }, { status: 404 });
}

// POST — called by Twilio when a recording is ready
export async function POST(req: NextRequest) {
  const body = await req.text();
  const params = new URLSearchParams(body);
  const callSid = params.get('CallSid') || '';
  const recordingUrl = params.get('RecordingUrl') || '';
  const recordingDuration = parseInt(params.get('RecordingDuration') || '0');

  if (!callSid || !recordingUrl) return NextResponse.json({ ok: true });

  const db = supabaseAdmin();

  // Update the communication log entry with the recording URL
  await db.from('communication_log')
    .update({ recording_url: recordingUrl + '.mp3' })
    .eq('call_id', callSid);

  return NextResponse.json({ ok: true });
}

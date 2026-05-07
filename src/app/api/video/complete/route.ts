import { NextRequest, NextResponse } from 'next/server';
import {
  verifyUpload, triggerStreamTranscode, updateRecordingStatus,
} from '@/lib/video';
import { supabaseAdmin } from '@/lib/db/client';
import { apiRateLimit } from '@/lib/rateLimit';

/**
 * POST /api/video/complete
 *
 * Step 2 of the upload flow — called by the browser after the R2 PUT succeeds.
 * Verifies the upload, triggers Stream transcoding, updates the database.
 */
export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
  if (!apiRateLimit(ip).allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  const { recordingId, r2Key, expectedSizeBytes } = await req.json();
  if (!recordingId || !r2Key) {
    return NextResponse.json({ error: 'recordingId and r2Key required' }, { status: 400 });
  }

  // 1. Verify the upload actually landed in R2
  const verification = await verifyUpload(r2Key);
  if (!verification.exists) {
    return NextResponse.json({ error: 'Upload not found in storage — please retry' }, { status: 404 });
  }

  // 2. Check file size matches (basic integrity check)
  if (expectedSizeBytes && Math.abs(verification.sizeBytes - expectedSizeBytes) > 1024) {
    return NextResponse.json({
      error: `File size mismatch: expected ${expectedSizeBytes} bytes, got ${verification.sizeBytes}`,
      code: 'SIZE_MISMATCH',
    }, { status: 400 });
  }

  // 3. Trigger Cloudflare Stream transcoding
  let streamUid = '';
  let streamError: string | undefined;

  try {
    const streamResult = await triggerStreamTranscode(r2Key);
    streamUid = streamResult.uid;

    // Update database with Stream UID and status
    const db = supabaseAdmin();
    await db.from('recordings').update({
      stream_uid: streamUid,
      stream_status: 'processing',
      file_size_bytes: verification.sizeBytes,
    }).eq('id', recordingId);

    // Update in-memory store
    updateRecordingStatus(recordingId, 'processing', { stream_uid: streamUid });

  } catch (err: unknown) {
    streamError = err instanceof Error ? err.message : 'Stream transcoding failed';
    console.error('[Video] Stream transcoding error:', streamError);

    // Update status to failed
    const db = supabaseAdmin();
    await db.from('recordings').update({ stream_status: 'failed' }).eq('id', recordingId);
    updateRecordingStatus(recordingId, 'failed');
  }

  if (streamError) {
    return NextResponse.json({
      ok: false,
      uploaded: true,
      transcoding: false,
      error: streamError,
      message: 'File uploaded successfully but transcoding failed. The raw file is safely stored in R2. Contact support.',
    }, { status: 202 });
  }

  return NextResponse.json({
    ok: true,
    uploaded: true,
    transcoding: true,
    streamUid,
    message: 'Upload verified. Video is being transcoded and will be available shortly.',
    // Polling endpoint for transcoding status
    statusUrl: `/api/video/status?recordingId=${recordingId}`,
  });
}

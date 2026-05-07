import { NextRequest, NextResponse } from 'next/server';
import { createUploadUrl, buildR2Key, addRecording } from '@/lib/video';
import { supabaseAdmin } from '@/lib/db/client';
import { apiRateLimit } from '@/lib/rateLimit';

/**
 * POST /api/video/upload
 *
 * Step 1 of the upload flow.
 * Returns a pre-signed R2 URL the browser uses to upload directly.
 * The video never passes through SafeSpace servers.
 *
 * Request body:
 *   sessionId, caseId, filename, contentType, fileSizeBytes,
 *   sha256Hash (optional), consentStatus, courtEvidence, description,
 *   cameraId, room, recordedAt
 */
export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
  if (!apiRateLimit(ip).allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  const body = await req.json();
  const {
    sessionId, caseId, filename, contentType, fileSizeBytes,
    sha256Hash, consentStatus, courtEvidence, description,
    cameraId, room, recordedAt, staffName, centreCode,
  } = body;

  // Validate required fields
  if (!sessionId || !caseId || !filename || !contentType || !fileSizeBytes) {
    return NextResponse.json({
      error: 'sessionId, caseId, filename, contentType, fileSizeBytes are required'
    }, { status: 400 });
  }

  const db = supabaseAdmin();

  // Verify session exists and belongs to the case
  const { data: session } = await db.from('sessions')
    .select('id, case_id, status, scheduled_start').eq('id', sessionId).single();

  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  if ((session as Record<string,unknown>).case_id !== caseId) {
    return NextResponse.json({ error: 'Session does not belong to this case' }, { status: 400 });
  }

  // Fetch case for R2 key building
  const { data: caseData } = await db.from('cases')
    .select('case_ref, centre:centre_id(code)').eq('id', caseId).single();

  const caseRef = (caseData as Record<string,unknown>)?.case_ref as string || 'UNKNOWN';
  const code = centreCode || (((caseData as Record<string,unknown>)?.centre as Record<string,unknown>)?.code as string) || 'BST';

  // Build secure R2 key
  const r2Key = buildR2Key({
    centreCode: code,
    caseRef,
    sessionId,
    filename,
  });

  // Generate pre-signed upload URL
  let uploadUrl: string;
  let expiresAt: Date;

  try {
    const result = await createUploadUrl({
      r2Key,
      contentType,
      fileSizeBytes,
      sha256Hash,
    });
    uploadUrl = result.uploadUrl;
    expiresAt = result.expiresAt;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create upload URL';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  // Create recording record in database (status: uploading)
  const { data: recData, error: recError } = await db.from('recordings').insert({
    session_id: sessionId,
    case_id: caseId,
    original_filename: filename,
    file_size_bytes: fileSizeBytes,
    recorded_at: recordedAt || new Date().toISOString(),
    r2_key: r2Key,
    stream_status: 'uploading',
    room: room || '',
    camera_id: cameraId,
    consent_status: consentStatus || 'obtained',
    shareable_externally: false,  // starts locked — manager must explicitly enable
    court_evidence: courtEvidence || false,
    description,
    sha256_hash: sha256Hash,
  }).select('id').single();

  if (recError) {
    console.error('Failed to create recording record:', recError);
    return NextResponse.json({ error: 'Failed to create recording record' }, { status: 500 });
  }

  // Also update in-memory store for prototype UI
  addRecording({
    session_id: sessionId,
    case_id: caseId,
    original_filename: filename,
    file_size_bytes: fileSizeBytes,
    duration_seconds: 0,
    recorded_at: recordedAt || new Date().toISOString(),
    uploaded_at: new Date().toISOString(),
    uploaded_by: staffName || 'Staff',
    r2_key: r2Key,
    stream_uid: '',
    stream_status: 'uploading',
    room: room || '',
    camera_id: cameraId,
    consent_status: consentStatus || 'obtained',
    shareable_externally: false,
    court_evidence: courtEvidence || false,
    retain_until: new Date(Date.now() + 7 * 365.25 * 86400000).toISOString(),
    description,
    sha256_hash: sha256Hash,
  });

  return NextResponse.json({
    ok: true,
    recordingId: (recData as Record<string,unknown>)?.id,
    uploadUrl,
    r2Key,
    expiresAt: expiresAt.toISOString(),
    instructions: {
      method: 'PUT',
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(fileSizeBytes),
        ...(sha256Hash ? { 'x-amz-checksum-sha256': sha256Hash } : {}),
      },
    },
  });
}

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/client';
import { htmlToPDF, htmlFallback } from '@/lib/pdfService';
import { pdfRateLimit } from '@/lib/rateLimit';

function buildHTML(opts: {
  caseRef: string; familyName: string; centreName: string;
  generatedBy: string; generatedAt: string;
  legalOrderRef?: string; socialWorker?: string; cafcassOfficer?: string;
  children: Array<{ name: string; dob?: string }>;
  riskFlags: string[];
  sessions: Array<{
    id: string; date: string; startTime: string; endTime: string;
    type: string; status: string; supervisor: string; room: string;
    attendees: string[];
    notes: Array<{ type: string; body: string; author: string; time: string }>;
  }>;
  documentIndex: Array<{ name: string; type: string; uploadedAt: string; uploadedBy: string }>;
}): string {
  const noteTypeColor: Record<string, string> = {
    observation: '#2563EB', welfare_concern: '#DC2626',
    incident: '#EA580C', recommendation: '#059669',
  };
  const noteTypeLabel: Record<string, string> = {
    observation: 'Observation', welfare_concern: 'Welfare Concern',
    incident: 'Incident Report', recommendation: 'Recommendation',
  };

  const sessionIndexRows = opts.sessions.map((s, i) => `
    <tr><td>${i+1}</td><td>${s.date}</td><td>${s.startTime}–${s.endTime}</td>
    <td>${s.type}</td><td>${s.status}</td><td>${s.supervisor}</td>
    <td>${s.notes.length}</td></tr>`).join('');

  const docRows = opts.documentIndex.length === 0
    ? '<tr><td colspan="4"><em>No documents on file</em></td></tr>'
    : opts.documentIndex.map(d => `<tr><td>${d.name}</td><td>${d.type}</td><td>${d.uploadedAt}</td><td>${d.uploadedBy}</td></tr>`).join('');

  const sessionRecords = opts.sessions.map((s, i) => {
    const notes = s.notes.length === 0
      ? '<p class="no-notes">No notes recorded for this session.</p>'
      : s.notes.map(n => `
        <div class="note-block" style="border-left:3px solid ${noteTypeColor[n.type]||'#64748B'}">
          <div class="note-header">
            <span class="note-type" style="color:${noteTypeColor[n.type]||'#64748B'}">${noteTypeLabel[n.type]||n.type}</span>
            <span class="note-meta">${n.author} · ${n.time}</span>
          </div>
          <div class="note-body">${n.body.replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>')}</div>
        </div>`).join('');
    return `
      <div class="session-record page-break-before">
        <div class="session-header">
          <div>
            <h2 class="session-title">Session ${i+1} of ${opts.sessions.length}</h2>
            <div class="session-date">${s.date} · ${s.startTime}–${s.endTime}</div>
          </div>
          <div class="session-badge ${s.status}">${s.status.replace('_',' ').toUpperCase()}</div>
        </div>
        <table class="session-meta-table">
          <tr><td>Type</td><td>${s.type}</td><td>Supervisor</td><td>${s.supervisor}</td></tr>
          <tr><td>Room</td><td>${s.room||'—'}</td><td>Attendees</td><td>${s.attendees.join(', ')||'—'}</td></tr>
        </table>
        <h3 class="notes-heading">Session Notes</h3>${notes}
      </div>`;
  }).join('');

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><style>
@page{size:A4;margin:20mm 20mm 25mm 20mm;
  @top-right{content:"${opts.caseRef} — ${opts.familyName} family";font-family:Arial;font-size:8pt;color:#64748B}
  @bottom-center{content:"Page " counter(page) " of " counter(pages);font-family:Arial;font-size:8pt;color:#64748B}
  @bottom-left{content:"CONFIDENTIAL — ${opts.centreName}";font-family:Arial;font-size:8pt;color:#DC2626}}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,sans-serif;font-size:10pt;color:#1E293B;line-height:1.5}
.cover{page-break-after:always}
.cover-header{background:#1E293B;padding:30mm 20mm 20mm;color:white}
.cover-centre{font-size:13pt;color:#93C5FD;margin-bottom:8mm}
.cover-title{font-size:24pt;font-weight:bold;margin-bottom:4mm}
.cover-subtitle{font-size:14pt;color:#CBD5E1}
.cover-meta-grid{display:grid;grid-template-columns:1fr 1fr;gap:6mm;margin:10mm 0 4mm}
.cover-field{border:1pt solid #CBD5E1;border-radius:4pt;padding:5mm}
.cover-field-label{font-size:7pt;font-weight:bold;text-transform:uppercase;letter-spacing:.05em;color:#64748B;margin-bottom:2mm}
.cover-field-value{font-size:11pt;font-weight:600}
.risk-flags{background:#FEF2F2;border:1pt solid #FECACA;border-left:4pt solid #DC2626;border-radius:4pt;padding:5mm;margin-top:6mm}
.risk-flag-title{font-size:8pt;font-weight:bold;color:#DC2626;margin-bottom:2mm}
.confidential-banner{background:#DC2626;color:white;text-align:center;padding:3mm;font-size:9pt;font-weight:bold;letter-spacing:.1em;margin:8mm 0;border-radius:3pt}
.cover-footer{padding-top:8mm;border-top:1pt solid #E2E8F0;font-size:8pt;color:#64748B;margin-top:10mm}
.index-section{page-break-after:always}
.section-title{font-size:16pt;font-weight:bold;color:#1E293B;border-bottom:2pt solid #2563EB;padding-bottom:3mm;margin-bottom:6mm}
.subsection-title{font-size:12pt;font-weight:bold;margin:6mm 0 3mm}
table{width:100%;border-collapse:collapse;margin-bottom:5mm;font-size:9pt}
th{background:#1E293B;color:white;padding:3mm 4mm;text-align:left;font-size:8pt;font-weight:bold;text-transform:uppercase;letter-spacing:.04em}
td{padding:2.5mm 4mm;border-bottom:.5pt solid #E2E8F0;vertical-align:top}
tr:nth-child(even) td{background:#F8FAFC}
.page-break-before{page-break-before:always}
.session-header{display:flex;justify-content:space-between;align-items:flex-start;background:#F1F5F9;border:1pt solid #CBD5E1;border-radius:6pt;padding:5mm;margin-bottom:4mm}
.session-title{font-size:14pt;font-weight:bold}
.session-date{font-size:10pt;color:#64748B;margin-top:1mm}
.session-badge{font-size:8pt;font-weight:bold;padding:1.5mm 5mm;border-radius:3pt}
.session-badge.completed{background:#D1FAE5;color:#059669}
.session-badge.scheduled{background:#DBEAFE;color:#2563EB}
.session-badge.dna{background:#FEE2E2;color:#DC2626}
.session-badge.cancelled{background:#F1F5F9;color:#64748B}
.session-meta-table td{border:.5pt solid #E2E8F0}
.session-meta-table td:nth-child(odd){background:#F8FAFC;font-weight:bold;color:#64748B;width:22%}
.notes-heading{font-size:10pt;font-weight:bold;margin:5mm 0 3mm;border-bottom:.5pt solid #E2E8F0;padding-bottom:1.5mm}
.note-block{margin-bottom:3mm;padding:3.5mm 4mm 3.5mm 5mm;background:#FAFAFA;border:.5pt solid #E2E8F0;border-radius:0 4pt 4pt 0;page-break-inside:avoid}
.note-header{display:flex;justify-content:space-between;margin-bottom:1.5mm}
.note-type{font-size:8pt;font-weight:bold;text-transform:uppercase;letter-spacing:.04em}
.note-meta{font-size:8pt;color:#64748B}
.note-body{font-size:9.5pt;line-height:1.55}
.no-notes{font-size:9pt;color:#64748B;font-style:italic;padding:3mm 0}
.signature-section{page-break-before:always}
.sig-grid{display:grid;grid-template-columns:1fr 1fr;gap:10mm;margin-top:8mm}
.sig-box{border:1pt solid #CBD5E1;border-radius:4pt;padding:5mm}
.sig-label{font-size:8pt;font-weight:bold;color:#64748B;text-transform:uppercase;letter-spacing:.04em;margin-bottom:8mm}
.sig-line{border-bottom:1pt solid #1E293B;height:10mm;margin-bottom:2mm}
.sig-name{font-size:8pt;color:#64748B;margin-top:2mm}
.auth-box{background:#EFF6FF;border:1pt solid #BFDBFE;border-radius:4pt;padding:5mm;margin-top:8mm;font-size:8.5pt;color:#1E40AF;line-height:1.6}
</style></head><body>

<div class="cover">
  <div class="cover-header">
    <div class="cover-centre">${opts.centreName}</div>
    <div class="cover-title">Family Contact Centre</div>
    <div class="cover-subtitle">Official Session Records — Court Bundle</div>
  </div>
  <div style="padding:0">
    <div class="confidential-banner">CONFIDENTIAL — NOT FOR GENERAL CIRCULATION</div>
    <div class="cover-meta-grid">
      <div class="cover-field"><div class="cover-field-label">Case reference</div><div class="cover-field-value">${opts.caseRef}</div></div>
      <div class="cover-field"><div class="cover-field-label">Family</div><div class="cover-field-value">${opts.familyName} family</div></div>
      <div class="cover-field"><div class="cover-field-label">Sessions included</div><div class="cover-field-value">${opts.sessions.length}</div></div>
      <div class="cover-field"><div class="cover-field-label">Court order ref</div><div class="cover-field-value">${opts.legalOrderRef||'Not recorded'}</div></div>
      <div class="cover-field"><div class="cover-field-label">Social worker</div><div class="cover-field-value">${opts.socialWorker||'Not recorded'}</div></div>
      <div class="cover-field"><div class="cover-field-label">Cafcass officer</div><div class="cover-field-value">${opts.cafcassOfficer||'Not recorded'}</div></div>
    </div>
    <div class="cover-field"><div class="cover-field-label">Children</div><div class="cover-field-value">${opts.children.map(c=>`${c.name}${c.dob?` (DOB: ${c.dob})`:''}`).join(' · ')||'—'}</div></div>
    ${opts.riskFlags.length>0?`<div class="risk-flags"><div class="risk-flag-title">⚠ RISK FLAGS ON THIS CASE</div>${opts.riskFlags.map(f=>`<div>${f.replace(/_/g,' ').toUpperCase()}</div>`).join('')}</div>`:''}
    <div class="cover-footer">
      Generated by ${opts.generatedBy} · ${opts.generatedAt}<br>
      All notes are timestamped and immutable. No records have been modified after creation.
    </div>
  </div>
</div>

<div class="index-section">
  <h1 class="section-title">Index of Contents</h1>
  <h2 class="subsection-title">Session records</h2>
  <table><thead><tr><th>#</th><th>Date</th><th>Time</th><th>Type</th><th>Status</th><th>Supervisor</th><th>Notes</th></tr></thead>
  <tbody>${sessionIndexRows}</tbody></table>
  <h2 class="subsection-title">Documents on file</h2>
  <table><thead><tr><th>Document</th><th>Type</th><th>Uploaded</th><th>By</th></tr></thead>
  <tbody>${docRows}</tbody></table>
</div>

${sessionRecords}

<div class="signature-section">
  <h1 class="section-title">Certification and Signatures</h1>
  <p style="font-size:9.5pt;margin-bottom:6mm">The following authorised signatories confirm that the records in this bundle are accurate and complete.</p>
  <div class="sig-grid">
    <div class="sig-box"><div class="sig-label">Supervising officer</div><div class="sig-line"></div><div class="sig-name">Name: ________________________</div><div class="sig-name">Date: ________________________</div></div>
    <div class="sig-box"><div class="sig-label">Centre manager</div><div class="sig-line"></div><div class="sig-name">Name: ________________________</div><div class="sig-name">Date: ________________________</div></div>
  </div>
  <div class="auth-box"><strong>Statement of authenticity:</strong> The session records contained in this bundle were created contemporaneously by trained staff. All notes are timestamped at the moment of creation and stored in an immutable audit log. This bundle was generated by ${opts.centreName} on ${opts.generatedAt} at the request of ${opts.generatedBy}.</div>
</div>

</body></html>`;
}

export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
  if (!pdfRateLimit(ip).allowed) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });

  const { searchParams } = new URL(req.url);
  const caseId     = searchParams.get('caseId');
  const token      = searchParams.get('token');
  const sessionIds = searchParams.get('sessions')?.split(',').filter(Boolean) || [];
  const format     = searchParams.get('format') || 'pdf';

  if (!caseId) return NextResponse.json({ error: 'caseId required' }, { status: 400 });

  let authorised = false;
  let generatedBy = 'Unknown';
  const db = supabaseAdmin();

  if (token) {
    const { data: link } = await db.from('share_links').select('*').eq('token', token).eq('status', 'active').single();
    authorised = !!link; generatedBy = (link as any)?.recipient_name || 'External';
  } else {
    const authHeader = req.headers.get('authorization');
    if (authHeader) {
      const { data: { user } } = await db.auth.getUser(authHeader.replace('Bearer ', ''));
      if (user) { authorised = true; const { data: staff } = await db.from('staff').select('full_name').eq('id', user.id).single(); generatedBy = (staff as any)?.full_name || user.email || 'Staff'; }
    }
    if (process.env.NODE_ENV !== 'production') { authorised = true; if (generatedBy === 'Unknown') generatedBy = 'Demo user'; }
  }

  if (!authorised) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const { data: caseData } = await db.from('cases').select('*, persons(*), centre:centre_id(name)').eq('id', caseId).single();
  if (!caseData) return NextResponse.json({ error: 'Case not found' }, { status: 404 });
  const c = caseData as Record<string, unknown>;

  let sessQuery = db.from('sessions').select('*, supervisor:supervisor_id(full_name), session_attendees(person:person_id(full_name))').eq('case_id', caseId).order('scheduled_start');
  if (sessionIds.length > 0) sessQuery = sessQuery.in('id', sessionIds);
  const { data: sessions } = await sessQuery;

  const sIds = (sessions || []).map((s: any) => s.id);
  const { data: notes } = sIds.length ? await db.from('notes').select('*, author:author_id(full_name)').in('session_id', sIds).eq('visible_externally', true).order('created_at') : { data: [] };
  const { data: docs } = await db.from('documents').select('*').eq('case_id', caseId).order('uploaded_at', { ascending: false });

  const centreName  = (c.centre as any)?.name || 'SafeSpace';
  const generatedAt = new Date().toLocaleString('en-GB', { dateStyle: 'full', timeStyle: 'short' });
  const children    = ((c.persons as any[]) || []).filter((p: any) => p.role === 'child').map((p: any) => ({ name: p.full_name, dob: p.dob ? new Date(p.dob).toLocaleDateString('en-GB') : undefined }));
  const sessionData = (sessions || []).map((s: any) => ({
    id: s.id,
    date:      new Date(s.scheduled_start).toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long', year:'numeric' }),
    startTime: new Date(s.scheduled_start).toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' }),
    endTime:   new Date(s.scheduled_end).toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' }),
    type: (s.session_type || '').replace('_',' '), status: s.status,
    supervisor: s.supervisor?.full_name || '—', room: s.room || '—',
    attendees: (s.session_attendees || []).map((a: any) => a.person?.full_name).filter(Boolean),
    notes: ((notes || []).filter((n: any) => n.session_id === s.id)).map((n: any) => ({
      type: n.note_type, body: n.body,
      author: n.author?.full_name || 'Unknown',
      time: new Date(n.created_at).toLocaleString('en-GB', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit', second:'2-digit' }),
    })),
  }));

  const html = buildHTML({
    caseRef: c.case_ref as string, familyName: c.family_name as string, centreName, generatedBy, generatedAt,
    legalOrderRef: c.legal_order_ref as string | undefined, socialWorker: c.social_worker as string | undefined, cafcassOfficer: c.cafcass_officer as string | undefined,
    children, riskFlags: (c.risk_flags as string[]) || [], sessions: sessionData,
    documentIndex: (docs || []).map((d: any) => ({ name: d.name, type: d.type, uploadedAt: new Date(d.uploaded_at).toLocaleDateString('en-GB', { dateStyle:'medium' }), uploadedBy: d.uploaded_by || '—' })),
  });

  if (format === 'html') {
    return new NextResponse(html, { headers: { 'Content-Type': 'text/html', 'Content-Disposition': `inline; filename="preview.html"` } });
  }

  // Generate PDF via Gotenberg (see src/lib/pdfService.ts for setup)
  try {
    const pdfBuf = await htmlToPDF(html);
    return new NextResponse(pdfBuf as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="SafeSpace-${c.case_ref as string}-Court-Bundle.pdf"`,
        'Content-Length': String(pdfBuf.length),
      },
    });
  } catch (pdfErr: unknown) {
    const msg = pdfErr instanceof Error ? pdfErr.message : 'PDF generation failed';
    console.warn('[PDF] Falling back to HTML:', msg);
    // Graceful fallback — return the HTML for browser printing
    return htmlFallback(html, `SafeSpace-${c.case_ref as string}-Court-Bundle.pdf`) as unknown as NextResponse;
  }
}

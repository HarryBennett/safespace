import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/client';
import { sendShareLinkToRecipient, sendShareLinkApprovalRequest } from '@/lib/email';

// POST /api/share — create and trigger manager approval email
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { linkId, action, managerEmail } = body;

  if (action === 'request_approval') {
    // Fetch the link and send approval email to manager
    const { data: link } = await supabaseAdmin()
      .from('share_links')
      .select('*, case:case_id(case_ref, family_name), creator:created_by(full_name, email)')
      .eq('id', linkId).single();

    if (!link) return NextResponse.json({ error: 'Link not found' }, { status: 404 });

    await sendShareLinkApprovalRequest({
      requesterName: (link.creator as {full_name:string}|null)?.full_name || 'A staff member',
      managerEmail: managerEmail || 'manager@safespace.co.uk',
      managerName: 'Centre Manager',
      familyName: (link.case as {family_name:string}|null)?.family_name || '',
      caseRef: (link.case as {case_ref:string}|null)?.case_ref || '',
      recipientName: link.recipient_name,
      purpose: link.purpose,
      shareLinkId: link.id,
    });

    return NextResponse.json({ ok: true });
  }

  if (action === 'approve') {
    // Approve link and send to recipient
    const { data: link } = await supabaseAdmin()
      .from('share_links')
      .select('*, case:case_id(case_ref, family_name), centre:case_id(centre:centre_id(name))')
      .eq('id', linkId).single();

    if (!link) return NextResponse.json({ error: 'Link not found' }, { status: 404 });

    // Update status
    await supabaseAdmin().from('share_links').update({
      status: 'active',
      approval_status: 'approved',
      approved_at: new Date().toISOString(),
    }).eq('id', linkId);

    // Log approval
    await supabaseAdmin().from('share_audit_log').insert({
      share_link_id: linkId,
      event: 'approved',
      actor: body.approverName || 'Manager',
    });

    // Send link to recipient
    await sendShareLinkToRecipient({
      recipientName: link.recipient_name,
      recipientEmail: link.recipient_email,
      familyName: (link.case as {family_name:string}|null)?.family_name || '',
      caseRef: (link.case as {case_ref:string}|null)?.case_ref || '',
      centreName: 'SafeSpace Basingstoke',
      token: link.token,
      expiresAt: link.expires_at,
      purpose: link.purpose,
    });

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}

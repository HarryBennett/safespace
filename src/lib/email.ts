import 'server-only';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY || 're_placeholder');
const FROM = process.env.EMAIL_FROM || 'noreply@safespace.co.uk';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

// ── Share link notification ───────────────────────────────────────────────────

export async function sendShareLinkApprovalRequest(opts: {
  requesterName: string;
  managerEmail: string;
  managerName: string;
  familyName: string;
  caseRef: string;
  recipientName: string;
  purpose: string;
  shareLinkId: string;
}) {
  return resend.emails.send({
    from: FROM,
    to: opts.managerEmail,
    subject: `Approval required: share link for ${opts.familyName} family`,
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1a1a2e">
        <div style="background:#2563EB;padding:20px 24px;border-radius:8px 8px 0 0">
          <div style="color:white;font-size:18px;font-weight:600">SafeSpace · Share link approval</div>
        </div>
        <div style="background:#f8f9ff;padding:24px;border:1px solid #e0e7ff;border-top:none;border-radius:0 0 8px 8px">
          <p>Hi ${opts.managerName},</p>
          <p><strong>${opts.requesterName}</strong> has requested a secure share link requiring your approval.</p>
          <table style="width:100%;background:white;border:1px solid #e0e7ff;border-radius:6px;padding:16px;margin:16px 0;border-collapse:collapse">
            <tr><td style="padding:6px 0;color:#6b7280;font-size:13px">Case</td><td style="padding:6px 0;font-size:13px;font-weight:500">${opts.caseRef} — ${opts.familyName} family</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;font-size:13px">Recipient</td><td style="padding:6px 0;font-size:13px">${opts.recipientName}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;font-size:13px">Purpose</td><td style="padding:6px 0;font-size:13px">${opts.purpose}</td></tr>
          </table>
          <div style="text-align:center;margin:20px 0">
            <a href="${APP_URL}/sharing?review=${opts.shareLinkId}" style="background:#2563EB;color:white;padding:12px 24px;border-radius:7px;text-decoration:none;font-weight:500;font-size:14px">
              Review and approve →
            </a>
          </div>
          <p style="font-size:12px;color:#6b7280">No link will be sent until you approve. You can also reject with a reason from the platform.</p>
        </div>
      </div>
    `,
  });
}

export async function sendShareLinkToRecipient(opts: {
  recipientName: string;
  recipientEmail: string;
  familyName: string;
  caseRef: string;
  centreName: string;
  token: string;
  expiresAt: string;
  purpose: string;
}) {
  const portalUrl = `${APP_URL}/portal/${opts.token}`;
  const expiryDate = new Date(opts.expiresAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  return resend.emails.send({
    from: FROM,
    to: opts.recipientEmail,
    subject: `Secure family contact records — ${opts.familyName} family · ${opts.caseRef}`,
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1a1a2e">
        <div style="background:#2563EB;padding:20px 24px;border-radius:8px 8px 0 0">
          <div style="color:white;font-size:18px;font-weight:600">SafeSpace · Secure record access</div>
        </div>
        <div style="background:#f8f9ff;padding:24px;border:1px solid #e0e7ff;border-top:none;border-radius:0 0 8px 8px">
          <p>Dear ${opts.recipientName},</p>
          <p>${opts.centreName} has granted you secure access to session records for the <strong>${opts.familyName} family</strong> (${opts.caseRef}).</p>
          <div style="background:#EEF2FF;border-left:3px solid #2563EB;padding:12px 16px;margin:16px 0;border-radius:0 6px 6px 0;font-size:13px">
            <strong>Purpose of this share:</strong><br/>${opts.purpose}
          </div>
          <div style="text-align:center;margin:24px 0">
            <a href="${portalUrl}" style="background:#2563EB;color:white;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;display:inline-block">
              Access secure records →
            </a>
          </div>
          <div style="background:#FEF3C7;border:1px solid #F59E0B;border-radius:6px;padding:12px 14px;font-size:12px;color:#92400E;margin-top:16px">
            <strong>Security notice:</strong> This link is personal to you and expires on ${expiryDate}. All access is logged with your email address and IP. Do not share this link with others.
          </div>
        </div>
      </div>
    `,
  });
}

// ── Invoice email ─────────────────────────────────────────────────────────────

export async function sendInvoice(opts: {
  clientName: string;
  clientEmail: string;
  invoiceNumber: string;
  familyName: string;
  total: string;
  dueDate: string;
  paymentMethod: string;
  stripeLink?: string;
  centreName: string;
}) {
  return resend.emails.send({
    from: FROM,
    to: opts.clientEmail,
    subject: `Invoice ${opts.invoiceNumber} — ${opts.centreName}`,
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1a1a2e">
        <div style="background:#1e293b;padding:20px 24px;border-radius:8px 8px 0 0">
          <div style="color:white;font-size:18px;font-weight:600">${opts.centreName}</div>
          <div style="color:#94a3b8;font-size:13px">Invoice ${opts.invoiceNumber}</div>
        </div>
        <div style="background:#f8fafc;padding:24px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px">
          <p>Dear ${opts.clientName},</p>
          <p>Please find your invoice for contact centre services for the <strong>${opts.familyName} family</strong>.</p>
          <table style="width:100%;background:white;border:1px solid #e2e8f0;border-radius:6px;padding:16px;margin:16px 0;border-collapse:collapse">
            <tr><td style="padding:8px;color:#64748b;font-size:13px">Invoice number</td><td style="padding:8px;font-weight:600;font-size:13px">${opts.invoiceNumber}</td></tr>
            <tr><td style="padding:8px;color:#64748b;font-size:13px">Amount due</td><td style="padding:8px;font-weight:700;font-size:18px;color:#2563EB">${opts.total}</td></tr>
            <tr><td style="padding:8px;color:#64748b;font-size:13px">Due date</td><td style="padding:8px;font-size:13px">${opts.dueDate}</td></tr>
            <tr><td style="padding:8px;color:#64748b;font-size:13px">Payment</td><td style="padding:8px;font-size:13px">${opts.paymentMethod}</td></tr>
          </table>
          ${opts.stripeLink ? `
          <div style="text-align:center;margin:20px 0">
            <a href="${opts.stripeLink}" style="background:#6366F1;color:white;padding:12px 24px;border-radius:7px;text-decoration:none;font-weight:500;font-size:14px">
              Pay online →
            </a>
          </div>` : ''}
          <p style="font-size:12px;color:#64748b">For BACS payments, please include the invoice number as reference. If you have any queries, please contact your centre directly.</p>
        </div>
      </div>
    `,
  });
}

// ── Safeguarding notification ─────────────────────────────────────────────────

export async function sendSafeguardingAlert(opts: {
  managerEmail: string;
  managerName: string;
  reporterName: string;
  familyName: string;
  caseRef: string;
  category: string;
  incidentId: string;
}) {
  return resend.emails.send({
    from: FROM,
    to: opts.managerEmail,
    subject: `⚠ URGENT: Safeguarding incident — ${opts.familyName} family`,
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1a1a2e">
        <div style="background:#DC2626;padding:20px 24px;border-radius:8px 8px 0 0">
          <div style="color:white;font-size:18px;font-weight:600">⚠ Safeguarding incident reported</div>
        </div>
        <div style="background:#FFF5F5;padding:24px;border:1px solid #FED7D7;border-top:none;border-radius:0 0 8px 8px">
          <p>Hi ${opts.managerName},</p>
          <p>A safeguarding incident has been logged requiring your immediate review.</p>
          <table style="width:100%;background:white;border:1px solid #FED7D7;border-radius:6px;padding:16px;margin:16px 0;border-collapse:collapse">
            <tr><td style="padding:6px 0;color:#6b7280;font-size:13px">Case</td><td style="padding:6px 0;font-size:13px;font-weight:500">${opts.caseRef} — ${opts.familyName} family</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;font-size:13px">Category</td><td style="padding:6px 0;font-size:13px">${opts.category}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;font-size:13px">Reported by</td><td style="padding:6px 0;font-size:13px">${opts.reporterName}</td></tr>
          </table>
          <div style="text-align:center;margin:20px 0">
            <a href="${APP_URL}/safeguarding?id=${opts.incidentId}" style="background:#DC2626;color:white;padding:12px 24px;border-radius:7px;text-decoration:none;font-weight:600;font-size:14px">
              Review incident now →
            </a>
          </div>
          <p style="font-size:12px;color:#6b7280">This incident requires manager sign-off before the next session can proceed.</p>
        </div>
      </div>
    `,
  });
}

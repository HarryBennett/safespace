import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/client';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY || 're_placeholder');
const FROM   = process.env.EMAIL_FROM || 'noreply@safespace.co.uk';
const APP    = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

// Chase day thresholds
const CHASE_DAYS = [7, 14, 30] as const;
type ChaseDay = typeof CHASE_DAYS[number];

function chaseSubject(day: ChaseDay, invoiceNumber: string, total: string) {
  if (day === 7)  return `Payment reminder — Invoice ${invoiceNumber} (${total})`;
  if (day === 14) return `Second reminder — Invoice ${invoiceNumber} overdue`;
  return `Final notice — Invoice ${invoiceNumber} 30 days overdue`;
}

function chaseBody(day: ChaseDay, opts: {
  clientName: string; invoiceNumber: string; total: string;
  dueDate: string; centreName: string; stripeLink?: string;
}) {
  const urgency = day === 7
    ? { colour: '#2563EB', label: 'Friendly reminder', intro: `We wanted to remind you that payment for invoice ${opts.invoiceNumber} is due.` }
    : day === 14
    ? { colour: '#D97706', label: 'Payment overdue', intro: `Invoice ${opts.invoiceNumber} was due on ${opts.dueDate} and remains unpaid. Please arrange payment as soon as possible.` }
    : { colour: '#DC2626', label: 'Final notice', intro: `Invoice ${opts.invoiceNumber} is now 30 days overdue. If payment is not received within 7 days, we may need to pause services and refer this to our finance team.` };

  return `
<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1a1a2e">
  <div style="background:${urgency.colour};padding:16px 24px;border-radius:8px 8px 0 0">
    <div style="color:white;font-size:14px;font-weight:600">${opts.centreName} · ${urgency.label}</div>
  </div>
  <div style="background:#f8fafc;padding:24px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px">
    <p>Dear ${opts.clientName},</p>
    <p>${urgency.intro}</p>
    <table style="width:100%;background:white;border:1px solid #e2e8f0;border-radius:6px;padding:16px;margin:16px 0;border-collapse:collapse">
      <tr><td style="padding:6px 12px;color:#64748b;font-size:13px">Invoice</td><td style="padding:6px 12px;font-weight:600;font-size:13px">${opts.invoiceNumber}</td></tr>
      <tr><td style="padding:6px 12px;color:#64748b;font-size:13px">Amount due</td><td style="padding:6px 12px;font-weight:700;font-size:18px;color:${urgency.colour}">${opts.total}</td></tr>
      <tr><td style="padding:6px 12px;color:#64748b;font-size:13px">Original due date</td><td style="padding:6px 12px;font-size:13px">${opts.dueDate}</td></tr>
    </table>
    ${opts.stripeLink ? `
    <div style="text-align:center;margin:20px 0">
      <a href="${opts.stripeLink}" style="background:${urgency.colour};color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">Pay online now →</a>
    </div>` : `<p style="font-size:13px;color:#64748b">To pay by BACS, please use reference <strong>${opts.invoiceNumber}</strong> and contact your centre for bank details.</p>`}
    <p style="font-size:12px;color:#64748b;margin-top:16px">If you have already sent payment, please disregard this notice. If you have a query about this invoice, please contact your centre directly.</p>
  </div>
</div>`;
}

// POST /api/invoice/chase — called by cron job or manually from billing UI
export async function POST(req: NextRequest) {
  // Verify this is an internal call (cron secret or admin session)
  const secret = req.headers.get('x-cron-secret');
  if (secret !== process.env.CRON_SECRET && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  const db = supabaseAdmin();
  const now = new Date();

  // Fetch all sent/overdue invoices not yet paid or cancelled
  const { data: invoices, error } = await db
    .from('invoices')
    .select('*, case:case_id(case_ref, family_name), chase_log:invoice_chase_log(*)')
    .in('status', ['sent', 'overdue'])
    .not('due_at', 'is', null);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let chased = 0;
  let skipped = 0;
  const results: Array<{ invoice: string; day: number; sent_to: string }> = [];

  for (const inv of (invoices || [])) {
    const dueAt   = new Date(inv.due_at);
    const daysOverdue = Math.floor((now.getTime() - dueAt.getTime()) / 86400000);
    const alreadyChased = new Set((inv.chase_log || []).map((c: Record<string,unknown>) => Number(c.chase_day)));

    // Find which chase thresholds apply and haven't been sent yet
    for (const day of CHASE_DAYS) {
      if (daysOverdue < day) continue;          // Not due yet
      if (alreadyChased.has(day)) continue;     // Already chased at this threshold

      // Mark overdue if not already
      if (inv.status === 'sent' && daysOverdue > 0) {
        await db.from('invoices').update({ status: 'overdue' }).eq('id', inv.id);
      }

      const total    = `£${Number(inv.total).toLocaleString('en-GB', { minimumFractionDigits: 2 })}`;
      const dueDate  = new Date(inv.due_at).toLocaleDateString('en-GB', { dateStyle: 'long' });

      try {
        await resend.emails.send({
          from: FROM,
          to:   inv.client_email,
          subject: chaseSubject(day as ChaseDay, inv.invoice_number, total),
          html:    chaseBody(day as ChaseDay, {
            clientName:  inv.client_name,
            invoiceNumber: inv.invoice_number,
            total, dueDate,
            centreName: 'SafeSpace',
            stripeLink:  inv.stripe_payment_link || undefined,
          }),
        });

        // Log the chase
        await db.from('invoice_chase_log').insert({
          invoice_id: inv.id,
          chase_day:  day,
          sent_to:    inv.client_email,
          chased_at:  now.toISOString(),
          sent_by:    'system',
        });

        results.push({ invoice: inv.invoice_number, day, sent_to: inv.client_email });
        chased++;
      } catch (emailErr) {
        console.error(`Chase email failed for ${inv.invoice_number}:`, emailErr);
        skipped++;
      }

      break; // Only send one chase level per run per invoice
    }
  }

  return NextResponse.json({
    ok: true,
    chased,
    skipped,
    results,
    run_at: now.toISOString(),
  });
}

// GET — preview which invoices will be chased (dry run, no emails sent)
export async function GET(req: NextRequest) {
  const db  = supabaseAdmin();
  const now = new Date();

  const { data: invoices } = await db
    .from('invoices')
    .select('id, invoice_number, client_name, client_email, total, due_at, status, invoice_chase_log(*)')
    .in('status', ['sent', 'overdue'])
    .not('due_at', 'is', null);

  const preview = (invoices || []).map(inv => {
    const daysOverdue = Math.floor((now.getTime() - new Date(inv.due_at).getTime()) / 86400000);
    const alreadyChased = new Set((inv.invoice_chase_log || []).map((c: Record<string,unknown>) => Number(c.chase_day)));
    const nextChase = CHASE_DAYS.find(d => daysOverdue >= d && !alreadyChased.has(d));
    return {
      invoice_number: inv.invoice_number,
      client: inv.client_name,
      days_overdue: daysOverdue,
      next_chase_day: nextChase || null,
      already_chased: Array.from(alreadyChased),
      status: inv.status,
    };
  }).filter(i => i.next_chase_day !== null);

  return NextResponse.json({ preview, total: preview.length });
}

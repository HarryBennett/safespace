import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/client';
import { sendInvoice } from '@/lib/email';

export async function POST(req: NextRequest) {
  const { invoiceId } = await req.json();

  const { data: invoice } = await supabaseAdmin()
    .from('invoices')
    .select('*, case:case_id(case_ref, family_name), invoice_lines(*)')
    .eq('id', invoiceId).single();

  if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });

  const dueDate = new Date(Date.now() + 30 * 86400000).toLocaleDateString('en-GB', { dateStyle: 'long' });

  await sendInvoice({
    clientName: invoice.client_name,
    clientEmail: invoice.client_email,
    invoiceNumber: invoice.invoice_number,
    familyName: (invoice.case as {family_name:string}|null)?.family_name || '',
    total: `£${Number(invoice.total).toLocaleString('en-GB', { minimumFractionDigits: 2 })}`,
    dueDate,
    paymentMethod: invoice.payment_method,
    stripeLink: invoice.stripe_payment_link,
    centreName: 'SafeSpace Basingstoke',
  });

  // Update invoice status to sent
  await supabaseAdmin().from('invoices').update({
    status: 'sent',
    issued_at: new Date().toISOString(),
    due_at: new Date(Date.now() + 30 * 86400000).toISOString(),
  }).eq('id', invoiceId);

  return NextResponse.json({ ok: true });
}

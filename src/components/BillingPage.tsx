'use client';
import { useState } from 'react';
import { store, Invoice, InvoiceLine, InvoiceStatus } from '@/lib/store';
import { formatDate, formatDateTime, caseStatusBadge } from '@/lib/ui';

const Ico = {
  plus: <svg width="13" height="13" viewBox="0 0 13 13" fill="currentColor"><path d="M6.5 1v11M1 6.5h11"/></svg>,
  x: <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M2 2l9 9M11 2l-9 9" strokeLinecap="round"/></svg>,
  back: <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 3L5 7l4 4" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  send: <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M11.5 1.5L1.5 6l4 1.5 1.5 4 4.5-10z" strokeLinejoin="round"/></svg>,
  check: <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 7l3.5 3.5L11 3" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  stripe: <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><path d="M6.5 3.5c-1 0-1.5.5-1.5 1s.5 1 2 1.5c2 .5 2.5 1.5 2.5 2.5 0 1.5-1 2.5-3 2.5-1 0-2-.5-2.5-1l.5-1c.5.5 1.5 1 2 1 1 0 1.5-.5 1.5-1s-.5-1-2-1.5c-2-.5-2.5-1.5-2.5-2.5 0-1.5 1-2.5 3-2.5.5 0 1.5.5 2 1l-.5 1c-.5-.5-1.5-1-2-1z"/></svg>,
  doc: <svg width="13" height="13" viewBox="0 0 13 13" fill="currentColor"><path d="M2 1a1 1 0 011-1h5.586a1 1 0 01.707.293L11.707 2.707A1 1 0 0112 3.414V12a1 1 0 01-1 1H3a1 1 0 01-1-1V1zm2 4h6v1H4V5zm0 2.5h6v1H4v-1zm0 2.5h4v1H4V10z"/></svg>,
  trash: <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M2 3h9M5 3V2h3v1M4 3v7a1 1 0 001 1h3a1 1 0 001-1V3" strokeLinecap="round"/></svg>,
  warn: <svg width="12" height="12" viewBox="0 0 13 13" fill="currentColor"><path d="M6.5 1L13 12H0L6.5 1zm0 4v3M6.5 10v.5"/></svg>,
};

function Badge({ cls, label }: { cls: string; label: string }) {
  return <span className={`badge ${cls}`}>{label}</span>;
}

function invoiceStatusBadge(s: InvoiceStatus) {
  return { draft: 'bg-slate-700/40 text-slate-300 border border-slate-600/30', sent: 'bg-blue-900/30 text-blue-300 border border-blue-800/40', paid: 'bg-green-900/30 text-green-300 border border-green-800/40', overdue: 'bg-red-900/30 text-red-300 border border-red-800/40', cancelled: 'bg-slate-700/40 text-slate-400 border border-slate-600/30' }[s];
}

function fmt(n: number) { return `£${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }

function Modal({ title, subtitle, onClose, children, wide }: { title: string; subtitle?: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box fade-in" style={{ maxWidth: wide ? 640 : 480 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', marginBottom: 3 }}>{title}</h2>
            {subtitle && <p style={{ fontSize: 12, color: 'var(--text3)' }}>{subtitle}</p>}
          </div>
          <button onClick={onClose} className="btn-ghost" style={{ padding: '5px 8px', marginLeft: 12 }}>{Ico.x}</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function FormRow({ label, children }: { label: string; children: React.ReactNode }) {
  return <div style={{ marginBottom: 14 }}><label className="field-label">{label}</label>{children}</div>;
}

// ── Invoice detail view ───────────────────────────────────────────────────────
function InvoiceDetail({ invoice, onClose, onUpdate }: { invoice: Invoice; onClose: () => void; onUpdate: () => void }) {
  const [confirming, setConfirming] = useState<InvoiceStatus | null>(null);

  function act(status: InvoiceStatus) {
    store.updateInvoiceStatus(invoice.id, status);
    onUpdate();
    setConfirming(null);
  }

  const inv = store.getInvoiceById(invoice.id) || invoice;
  const daysOverdue = inv.due_at ? Math.floor((Date.now() - new Date(inv.due_at).getTime()) / 86400000) : 0;

  return (
    <Modal title={inv.invoice_number} subtitle={`${inv.family_name} family · ${inv.client_name}`} onClose={onClose} wide>
      {/* Status banner */}
      {inv.status === 'overdue' && (
        <div style={{ background: '#EF444410', border: '1px solid #EF444430', borderRadius: 8, padding: '10px 12px', marginBottom: 14, fontSize: 12, color: '#F87171', display: 'flex', gap: 8, alignItems: 'center' }}>
          {Ico.warn} Invoice {daysOverdue} days overdue. Due {inv.due_at ? formatDate(inv.due_at) : '—'}.
        </div>
      )}
      {inv.status === 'paid' && (
        <div style={{ background: '#10B98110', border: '1px solid #10B98130', borderRadius: 8, padding: '10px 12px', marginBottom: 14, fontSize: 12, color: '#10B981', display: 'flex', gap: 8, alignItems: 'center' }}>
          {Ico.check} Paid {inv.paid_at ? formatDate(inv.paid_at) : ''}
        </div>
      )}

      {/* Client / case info */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
        <div className="card-sm">
          <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Bill to</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{inv.client_name}</div>
          <div style={{ fontSize: 12, color: 'var(--text2)' }}>{inv.client_email}</div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>{inv.client_type === 'local_authority' ? 'Local authority' : inv.client_type === 'private' ? 'Private client' : 'Cafcass'}</div>
        </div>
        <div className="card-sm">
          <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Details</div>
          <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#3B82F6', marginBottom: 4 }}>{inv.case_ref}</div>
          <div style={{ fontSize: 12, color: 'var(--text2)' }}>Issued: {inv.issued_at ? formatDate(inv.issued_at) : 'Not sent'}</div>
          <div style={{ fontSize: 12, color: 'var(--text2)' }}>Due: {inv.due_at ? formatDate(inv.due_at) : '—'}</div>
          <div style={{ marginTop: 6 }}><Badge cls={invoiceStatusBadge(inv.status)} label={inv.status} /></div>
        </div>
      </div>

      {/* Line items */}
      <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', marginBottom: 16 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--surface2)' }}>
              <th style={{ padding: '9px 12px', fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'left' }}>Description</th>
              <th style={{ padding: '9px 12px', fontSize: 11, fontWeight: 600, color: 'var(--text3)', textAlign: 'right', whiteSpace: 'nowrap' }}>Qty</th>
              <th style={{ padding: '9px 12px', fontSize: 11, fontWeight: 600, color: 'var(--text3)', textAlign: 'right', whiteSpace: 'nowrap' }}>Unit</th>
              <th style={{ padding: '9px 12px', fontSize: 11, fontWeight: 600, color: 'var(--text3)', textAlign: 'right', whiteSpace: 'nowrap' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {inv.lines.map(l => (
              <tr key={l.id} style={{ borderTop: '1px solid var(--border)' }}>
                <td style={{ padding: '10px 12px', fontSize: 13, color: 'var(--text)' }}>{l.description}</td>
                <td style={{ padding: '10px 12px', fontSize: 13, color: 'var(--text2)', textAlign: 'right' }}>{l.quantity}</td>
                <td style={{ padding: '10px 12px', fontSize: 13, color: 'var(--text2)', textAlign: 'right', fontFamily: 'DM Mono, monospace' }}>{fmt(l.unit_price)}</td>
                <td style={{ padding: '10px 12px', fontSize: 13, color: 'var(--text)', textAlign: 'right', fontFamily: 'DM Mono, monospace', fontWeight: 500 }}>{fmt(l.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ padding: '12px', borderTop: '1px solid var(--border)', background: 'var(--surface2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}><span>Subtotal</span><span style={{ fontFamily: 'DM Mono, monospace' }}>{fmt(inv.subtotal)}</span></div>
          {inv.vat > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}><span>VAT (20%)</span><span style={{ fontFamily: 'DM Mono, monospace' }}>{fmt(inv.vat)}</span></div>}
          {inv.client_type === 'local_authority' && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}><span>VAT</span><span style={{ fontFamily: 'DM Mono, monospace', color: '#10B981' }}>Exempt (LA)</span></div>}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 600, color: 'var(--text)', borderTop: '1px solid var(--border)', paddingTop: 8, marginTop: 4 }}><span>Total</span><span style={{ fontFamily: 'DM Mono, monospace' }}>{fmt(inv.total)}</span></div>
        </div>
      </div>

      {inv.stripe_payment_link && inv.status !== 'paid' && (
        <div style={{ background: '#6366F110', border: '1px solid #6366F130', borderRadius: 8, padding: '10px 12px', marginBottom: 14, fontSize: 12, color: '#A5B4FC', display: 'flex', gap: 8, alignItems: 'center' }}>
          {Ico.stripe} Stripe payment link ready — client can pay online instantly
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', paddingTop: 12, borderTop: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {inv.status === 'draft' && <button className="btn-primary" onClick={() => act('sent')}>{Ico.send} Send invoice</button>}
          {(inv.status === 'sent' || inv.status === 'overdue') && <button className="btn-primary" style={{ background: '#10B981' }} onClick={() => act('paid')}>{Ico.check} Mark as paid</button>}
          {(inv.status === 'sent' || inv.status === 'overdue') && (
            <button className="btn-ghost" style={{ fontSize: 12 }} onClick={async () => {
              await fetch('/api/invoice/chase', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-cron-secret': 'manual' } });
              alert('Chase email sent');
            }}>📧 Send chase</button>
          )}
          {inv.status !== 'paid' && inv.status !== 'cancelled' && (
            <button className="btn-ghost" onClick={() => act('cancelled')}>Cancel</button>
          )}
        </div>
        <button className="btn-ghost" onClick={onClose}>Close</button>
      </div>
    </Modal>
  );
}

// ── New invoice modal ─────────────────────────────────────────────────────────
function NewInvoiceModal({ caseId, onClose, onCreated }: { caseId?: string; onClose: () => void; onCreated: () => void }) {
  const cases = store.getCases().filter(c => c.status === 'active');
  const [selCase, setSelCase] = useState(caseId || cases[0]?.id || '');
  const [clientName, setClientName] = useState('Hampshire County Council');
  const [clientEmail, setClientEmail] = useState('finance@hants.gov.uk');
  const [clientType, setClientType] = useState<'local_authority' | 'private' | 'cafcass'>('local_authority');
  const [payMethod, setPayMethod] = useState<'invoice' | 'stripe' | 'bacs'>('invoice');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<InvoiceLine[]>([
    { id: '1', description: 'Supervised contact session', type: 'supervised_session', quantity: 1, unit_price: 95, total: 95 },
  ]);

  function addLine() {
    setLines(p => [...p, { id: String(Date.now()), description: '', type: 'other', quantity: 1, unit_price: 0, total: 0 }]);
  }
  function removeLine(id: string) { setLines(p => p.filter(l => l.id !== id)); }
  function updateLine(id: string, field: string, value: string | number) {
    setLines(p => p.map(l => {
      if (l.id !== id) return l;
      const updated = { ...l, [field]: value };
      updated.total = Number(updated.quantity) * Number(updated.unit_price);
      return updated;
    }));
  }

  const sub = lines.reduce((a, l) => a + l.total, 0);
  const vat = clientType === 'private' ? Math.round(sub * 0.2 * 100) / 100 : 0;
  const total = sub + vat;

  const c = cases.find(x => x.id === selCase);

  function submit() {
    store.createInvoice({
      case_id: selCase, case_ref: c?.case_ref, family_name: c?.family_name,
      client_name: clientName, client_email: clientEmail, client_type: clientType,
      lines, payment_method: payMethod, notes,
      stripe_payment_link: payMethod === 'stripe' ? 'https://buy.stripe.com/demo' : undefined,
      created_by: 'Sarah Chen',
    });
    onCreated();
    onClose();
  }

  return (
    <Modal title="New invoice" subtitle="Create an invoice for a session block or individual session." onClose={onClose} wide>
      {!caseId && (
        <FormRow label="Case">
          <select className="field" value={selCase} onChange={e => setSelCase(e.target.value)}>
            {cases.map(c => <option key={c.id} value={c.id}>{c.case_ref} — {c.family_name} family</option>)}
          </select>
        </FormRow>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <FormRow label="Client / organisation"><input className="field" value={clientName} onChange={e => setClientName(e.target.value)} /></FormRow>
        <FormRow label="Billing email"><input className="field" type="email" value={clientEmail} onChange={e => setClientEmail(e.target.value)} /></FormRow>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <FormRow label="Client type">
          <select className="field" value={clientType} onChange={e => setClientType(e.target.value as any)}>
            <option value="local_authority">Local authority (VAT exempt)</option>
            <option value="private">Private client (+ 20% VAT)</option>
            <option value="cafcass">Cafcass (VAT exempt)</option>
          </select>
        </FormRow>
        <FormRow label="Payment method">
          <select className="field" value={payMethod} onChange={e => setPayMethod(e.target.value as any)}>
            <option value="invoice">Invoice (30-day payment)</option>
            <option value="stripe">Stripe (online payment link)</option>
            <option value="bacs">BACS transfer</option>
          </select>
        </FormRow>
      </div>

      {/* Line items */}
      <div style={{ marginBottom: 14 }}>
        <label className="field-label">Line items</label>
        <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', marginBottom: 8 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr style={{ background: 'var(--surface2)' }}>
              <th style={{ padding: '7px 10px', fontSize: 10, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', textAlign: 'left' }}>Description</th>
              <th style={{ padding: '7px 8px', fontSize: 10, fontWeight: 600, color: 'var(--text3)', textAlign: 'right', width: 50 }}>Qty</th>
              <th style={{ padding: '7px 8px', fontSize: 10, fontWeight: 600, color: 'var(--text3)', textAlign: 'right', width: 80 }}>Unit £</th>
              <th style={{ padding: '7px 8px', fontSize: 10, fontWeight: 600, color: 'var(--text3)', textAlign: 'right', width: 80 }}>Total</th>
              <th style={{ width: 30 }}></th>
            </tr></thead>
            <tbody>
              {lines.map(l => (
                <tr key={l.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: '6px 8px' }}><input className="field" style={{ padding: '5px 8px', fontSize: 12 }} value={l.description} onChange={e => updateLine(l.id, 'description', e.target.value)} placeholder="Description" /></td>
                  <td style={{ padding: '6px 6px' }}><input className="field" type="number" style={{ padding: '5px 6px', fontSize: 12, textAlign: 'right' }} value={l.quantity} onChange={e => updateLine(l.id, 'quantity', Number(e.target.value))} min={1} /></td>
                  <td style={{ padding: '6px 6px' }}><input className="field" type="number" style={{ padding: '5px 6px', fontSize: 12, textAlign: 'right' }} value={l.unit_price} onChange={e => updateLine(l.id, 'unit_price', Number(e.target.value))} /></td>
                  <td style={{ padding: '6px 8px', fontFamily: 'DM Mono, monospace', fontSize: 12, color: 'var(--text)', textAlign: 'right' }}>{fmt(l.total)}</td>
                  <td style={{ padding: '6px 6px', textAlign: 'center' }}><button onClick={() => removeLine(l.id)} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', padding: 4 }}>{Ico.trash}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button className="btn-ghost" style={{ fontSize: 12, padding: '5px 10px' }} onClick={addLine}>{Ico.plus} Add line</button>
      </div>

      {/* Totals */}
      <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: '12px 14px', marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}><span>Subtotal</span><span style={{ fontFamily: 'DM Mono, monospace' }}>{fmt(sub)}</span></div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}><span>VAT</span><span style={{ fontFamily: 'DM Mono, monospace', color: vat > 0 ? 'var(--text2)' : '#10B981' }}>{vat > 0 ? fmt(vat) : 'Exempt'}</span></div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 600, color: 'var(--text)', borderTop: '1px solid var(--border)', paddingTop: 8, marginTop: 4 }}><span>Total</span><span style={{ fontFamily: 'DM Mono, monospace' }}>{fmt(total)}</span></div>
      </div>

      <FormRow label="Notes (optional)"><textarea className="field" style={{ minHeight: 56 }} value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. April 2026 block — sessions 5–8" /></FormRow>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 12, borderTop: '1px solid var(--border)' }}>
        <button className="btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={submit} style={{ opacity: lines.length && clientName ? 1 : 0.4 }}>{Ico.doc} Create invoice</button>
      </div>
    </Modal>
  );
}

// ── Main Billing Page ─────────────────────────────────────────────────────────
export default function BillingPage({ caseId }: { caseId?: string }) {
  const [showNew, setShowNew] = useState(false);
  const [viewing, setViewing] = useState<Invoice | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [refresh, setRefresh] = useState(0);
  const bump = () => setRefresh(r => r + 1);

  const allInvoices = caseId ? store.getInvoicesByCase(caseId) : store.getInvoices();
  const filtered = allInvoices.filter(i => statusFilter === 'all' || i.status === statusFilter);
  const stats = store.getRevenueStats();

  return (
    <div className="fade-in">
      {showNew && <NewInvoiceModal caseId={caseId} onClose={() => setShowNew(false)} onCreated={bump} />}
      {viewing && <InvoiceDetail invoice={viewing} onClose={() => { setViewing(null); bump(); }} onUpdate={bump} />}

      {!caseId && (
        <>
          {/* Revenue metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 18 }}>
            {[
              { label: 'Revenue collected', value: fmt(stats.paid), color: '#10B981' },
              { label: 'Outstanding', value: fmt(stats.outstanding), color: stats.outstanding > 0 ? '#F59E0B' : undefined },
              { label: 'Overdue', value: fmt(stats.overdue), color: stats.overdue > 0 ? '#EF4444' : undefined },
              { label: 'Total invoices', value: stats.invoiceCount },
            ].map(m => (
              <div key={m.label} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px' }}>
                <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 6 }}>{m.label}</div>
                <div style={{ fontSize: 24, fontWeight: 600, color: m.color || 'var(--text)', lineHeight: 1, fontFamily: 'DM Mono, monospace' }}>{m.value}</div>
              </div>
            ))}
          </div>

          {/* Revenue by source */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 18 }}>
            <div className="card">
              <div className="section-label">Revenue collected by source</div>
              {[
                { label: 'Local authority', val: stats.bySource.local_authority, color: '#3B82F6' },
                { label: 'Private clients', val: stats.bySource.private, color: '#8B5CF6' },
                { label: 'Cafcass', val: stats.bySource.cafcass, color: '#14B8A6' },
              ].map(r => (
                <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <div style={{ fontSize: 13, color: 'var(--text)', width: 130 }}>{r.label}</div>
                  <div style={{ flex: 1, background: 'var(--surface3)', borderRadius: 4, height: 8, overflow: 'hidden' }}>
                    <div style={{ width: stats.paid ? `${(r.val / stats.paid * 100)}%` : '0%', background: r.color, height: '100%', borderRadius: 4 }} />
                  </div>
                  <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, color: 'var(--text2)', minWidth: 70, textAlign: 'right' }}>{fmt(r.val)}</div>
                </div>
              ))}
            </div>
            <div className="card">
              <div className="section-label">Invoice status breakdown</div>
              {(['paid','sent','overdue','draft','cancelled'] as InvoiceStatus[]).map(s => {
                const count = allInvoices.filter(i => i.status === s).length;
                const val = allInvoices.filter(i => i.status === s).reduce((a, i) => a + i.total, 0);
                if (!count) return null;
                return (
                  <div key={s} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Badge cls={invoiceStatusBadge(s)} label={s} />
                      <span style={{ color: 'var(--text3)', fontSize: 12 }}>{count} invoice{count !== 1 ? 's' : ''}</span>
                    </div>
                    <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, color: 'var(--text2)' }}>{fmt(val)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Invoices table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
          <span className="section-label" style={{ marginBottom: 0 }}>Invoices</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <select className="field" style={{ width: 150, padding: '5px 10px', fontSize: 12 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="all">All statuses</option>
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="paid">Paid</option>
              <option value="overdue">Overdue</option>
            </select>
            <button className="btn-primary" style={{ fontSize: 12 }} onClick={() => setShowNew(true)}>{Ico.plus} New invoice</button>
          </div>
        </div>
        <table className="data-table">
          <thead><tr><th>Invoice</th><th>Case</th><th>Client</th><th>Method</th><th>Issued</th><th>Due</th><th>Total</th><th>Status</th></tr></thead>
          <tbody>
            {filtered.map(inv => (
              <tr key={inv.id} onClick={() => setViewing(inv)}>
                <td><span style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, color: '#3B82F6' }}>{inv.invoice_number}</span></td>
                <td>
                  <div style={{ fontSize: 13 }}>{inv.family_name} family</div>
                  <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: 'var(--text3)' }}>{inv.case_ref}</div>
                </td>
                <td style={{ color: 'var(--text2)' }}>{inv.client_name}</td>
                <td style={{ color: 'var(--text3)' }}>
                  {inv.payment_method === 'stripe' ? <span style={{ color: '#A5B4FC' }}>{Ico.stripe} Stripe</span> : inv.payment_method.toUpperCase()}
                </td>
                <td style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: 'var(--text3)' }}>{inv.issued_at ? formatDate(inv.issued_at) : <span style={{ color: 'var(--text3)' }}>Draft</span>}</td>
                <td style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: inv.status === 'overdue' ? '#F87171' : 'var(--text3)' }}>{inv.due_at ? formatDate(inv.due_at) : '—'}</td>
                <td style={{ fontFamily: 'DM Mono, monospace', fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{fmt(inv.total)}</td>
                <td><Badge cls={invoiceStatusBadge(inv.status)} label={inv.status} /></td>
              </tr>
            ))}
            {!filtered.length && <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--text3)', padding: 24 }}>No invoices found.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

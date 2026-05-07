'use client';
import { useState } from 'react';
import { storeExt as store, WaitingListEntry, ReferralSource, RiskFlag, SessionType } from '@/lib/store';
import { formatDate, riskFlagLabel, referralLabel } from '@/lib/ui';

const priorityLabel = ['', 'Urgent — court ordered', 'High — LA priority', 'Standard', 'Low', 'Self-referred'];
const priorityColor = ['', '#EF4444', '#F59E0B', '#3B82F6', '#8B5CF6', '#6B7280'];

function Badge({ cls, label }: { cls: string; label: string }) {
  return <span className={`badge ${cls}`}>{label}</span>;
}

function Modal({ title, subtitle, onClose, children }: { title: string; subtitle?: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box fade-in" style={{ maxWidth: 520 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', marginBottom: 3 }}>{title}</h2>
            {subtitle && <p style={{ fontSize: 12, color: 'var(--text3)' }}>{subtitle}</p>}
          </div>
          <button onClick={onClose} className="btn-ghost" style={{ padding: '5px 8px' }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function FormRow({ label, children }: { label: string; children: React.ReactNode }) {
  return <div style={{ marginBottom: 14 }}><label className="field-label">{label}</label>{children}</div>;
}

function NewEntryModal({ onClose, onAdd }: { onClose: () => void; onAdd: () => void }) {
  const [form, setForm] = useState({ family_name: '', referral_source: 'local_authority' as ReferralSource, session_type_needed: 'supervised' as SessionType | 'any', la_name: '', social_worker: '', social_worker_email: '', notes: '', priority: 3 as 1|2|3|4|5, risk_flags: [] as RiskFlag[] });
  const riskOptions: RiskFlag[] = ['domestic_violence','court_injunction','safeguarding','legal_proceedings','prohibited_steps_order'];

  function toggle(f: RiskFlag) {
    setForm(p => ({ ...p, risk_flags: p.risk_flags.includes(f) ? p.risk_flags.filter(x => x !== f) : [...p.risk_flags, f] }));
  }

  function submit() {
    if (!form.family_name.trim()) return;
    store.addToWaitingList({ ...form, created_by: 'Sarah Chen' });
    onAdd(); onClose();
  }

  return (
    <Modal title="Add to waiting list" subtitle="Families are ordered by priority then referral date." onClose={onClose}>
      <FormRow label="Family name"><input className="field" value={form.family_name} onChange={e => setForm(p => ({ ...p, family_name: e.target.value }))} placeholder="e.g. Fletcher family" /></FormRow>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <FormRow label="Referral source">
          <select className="field" value={form.referral_source} onChange={e => setForm(p => ({ ...p, referral_source: e.target.value as ReferralSource }))}>
            <option value="local_authority">Local authority</option>
            <option value="cafcass">Cafcass</option>
            <option value="court_ordered">Court ordered</option>
            <option value="private">Private</option>
          </select>
        </FormRow>
        <FormRow label="Session type needed">
          <select className="field" value={form.session_type_needed} onChange={e => setForm(p => ({ ...p, session_type_needed: e.target.value as any }))}>
            <option value="supervised">Supervised</option>
            <option value="supported">Supported</option>
            <option value="handover">Handover</option>
            <option value="any">Any / unknown</option>
          </select>
        </FormRow>
      </div>
      <FormRow label="Priority">
        <select className="field" value={form.priority} onChange={e => setForm(p => ({ ...p, priority: Number(e.target.value) as any }))}>
          <option value={1}>1 — Urgent (court ordered)</option>
          <option value={2}>2 — High (LA priority)</option>
          <option value={3}>3 — Standard</option>
          <option value={4}>4 — Low</option>
          <option value={5}>5 — Self-referred</option>
        </select>
      </FormRow>
      <FormRow label="LA / referrer name">
        <input className="field" value={form.la_name} onChange={e => setForm(p => ({ ...p, la_name: e.target.value }))} placeholder="e.g. Hampshire County Council" />
      </FormRow>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <FormRow label="Social worker"><input className="field" value={form.social_worker} onChange={e => setForm(p => ({ ...p, social_worker: e.target.value }))} /></FormRow>
        <FormRow label="SW email"><input className="field" type="email" value={form.social_worker_email} onChange={e => setForm(p => ({ ...p, social_worker_email: e.target.value }))} /></FormRow>
      </div>
      <FormRow label="Risk flags">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
          {riskOptions.map(f => (
            <label key={f} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text2)', cursor: 'pointer' }}>
              <input type="checkbox" checked={form.risk_flags.includes(f)} onChange={() => toggle(f)} style={{ accentColor: '#3B82F6' }} />
              {riskFlagLabel[f]}
            </label>
          ))}
        </div>
      </FormRow>
      <FormRow label="Notes"><textarea className="field" style={{ minHeight: 60 }} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Any urgent context, court dates, etc." /></FormRow>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 12, borderTop: '1px solid var(--border)' }}>
        <button className="btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={submit} style={{ opacity: form.family_name.trim() ? 1 : 0.4 }}>Add to waiting list</button>
      </div>
    </Modal>
  );
}

export default function WaitingListPage() {
  const [showNew, setShowNew] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const bump = () => setRefresh(r => r + 1);
  const list = store.getWaitingList();
  const waiting = list.filter(e => e.status === 'waiting');
  const days_waiting = (entry: WaitingListEntry) => Math.floor((Date.now() - new Date(entry.referred_at).getTime()) / 86400000);

  return (
    <div className="fade-in">
      {showNew && <NewEntryModal onClose={() => setShowNew(false)} onAdd={bump} />}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 18 }}>
        {[
          { label: 'Waiting', value: waiting.length, color: waiting.length > 5 ? '#F59E0B' : undefined },
          { label: 'Priority 1 & 2', value: waiting.filter(e => e.priority <= 2).length, color: '#EF4444' },
          { label: 'Avg wait (days)', value: waiting.length ? Math.round(waiting.reduce((a, e) => a + days_waiting(e), 0) / waiting.length) : 0 },
          { label: 'Longest wait', value: waiting.length ? `${Math.max(...waiting.map(days_waiting))}d` : '—', color: '#F59E0B' },
        ].map(m => (
          <div key={m.label} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 6 }}>{m.label}</div>
            <div style={{ fontSize: 28, fontWeight: 600, color: m.color || 'var(--text)', lineHeight: 1 }}>{m.value}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
          <span className="section-label" style={{ marginBottom: 0 }}>Waiting list — sorted by priority</span>
          <button className="btn-primary" style={{ fontSize: 12 }} onClick={() => setShowNew(true)}>+ Add family</button>
        </div>
        {waiting.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>✓ No families currently waiting</div>
        ) : (
          <table className="data-table">
            <thead><tr><th>Priority</th><th>Family</th><th>Type needed</th><th>Referral</th><th>Risk flags</th><th>Social worker</th><th>Waiting</th><th></th></tr></thead>
            <tbody>
              {waiting.map(e => (
                <tr key={e.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: priorityColor[e.priority], flexShrink: 0 }} />
                      <span style={{ fontSize: 12, color: priorityColor[e.priority], fontWeight: 500 }}>P{e.priority}</span>
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>{priorityLabel[e.priority]}</div>
                  </td>
                  <td>
                    <div>{e.family_name} family</div>
                    {e.la_name && <div style={{ fontSize: 11, color: 'var(--text3)' }}>{e.la_name}</div>}
                  </td>
                  <td><Badge cls="bg-slate-700/40 text-slate-300 border border-slate-600/30" label={e.session_type_needed} /></td>
                  <td><Badge cls="bg-slate-700/40 text-slate-300 border border-slate-600/30" label={referralLabel[e.referral_source]} /></td>
                  <td>{e.risk_flags.slice(0,2).map(f => <Badge key={f} cls="bg-red-900/20 text-red-400 border border-red-800/30" label={riskFlagLabel[f]} />)}</td>
                  <td style={{ color: 'var(--text3)', fontSize: 12 }}>{e.social_worker || '—'}</td>
                  <td>
                    <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 13, color: days_waiting(e) > 28 ? '#F87171' : 'var(--text2)', fontWeight: 500 }}>{days_waiting(e)}d</div>
                    <div style={{ fontSize: 10, color: 'var(--text3)' }}>{formatDate(e.referred_at)}</div>
                  </td>
                  <td>
                    <button className="btn-primary" style={{ padding: '4px 10px', fontSize: 11 }}
                      onClick={() => { store.updateWaitingStatus(e.id, 'active'); bump(); }}>
                      Activate →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

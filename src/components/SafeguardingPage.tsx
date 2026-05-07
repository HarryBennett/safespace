'use client';
import { useState } from 'react';
import { store, SafeguardingIncident, SafeguardingCategory, SafeguardingStatus } from '@/lib/store';
import { formatDateTime, formatDate } from '@/lib/ui';

const categoryLabel: Record<SafeguardingCategory, string> = {
  physical_harm: 'Physical harm',
  emotional_harm: 'Emotional harm',
  neglect: 'Neglect',
  sexual_harm: 'Sexual harm',
  domestic_violence: 'Domestic violence',
  parental_behaviour: 'Parental behaviour',
  other: 'Other',
};

const statusLabel: Record<SafeguardingStatus, string> = {
  open: 'Open',
  referred: 'Referred',
  monitoring: 'Monitoring',
  closed: 'Closed',
};

function statusBadge(s: SafeguardingStatus) {
  return {
    open: 'bg-red-900/30 text-red-300 border border-red-800/40',
    referred: 'bg-amber-900/30 text-amber-300 border border-amber-800/40',
    monitoring: 'bg-blue-900/30 text-blue-300 border border-blue-800/40',
    closed: 'bg-slate-700/40 text-slate-400 border border-slate-600/30',
  }[s];
}

function categoryBadge(c: SafeguardingCategory) {
  if (c === 'physical_harm' || c === 'sexual_harm') return 'bg-red-900/30 text-red-300 border border-red-800/40';
  if (c === 'emotional_harm' || c === 'domestic_violence') return 'bg-orange-900/30 text-orange-300 border border-orange-800/40';
  if (c === 'parental_behaviour') return 'bg-amber-900/30 text-amber-300 border border-amber-800/40';
  return 'bg-slate-700/40 text-slate-300 border border-slate-600/30';
}

function Badge({ cls, label }: { cls: string; label: string }) {
  return <span className={`badge ${cls}`}>{label}</span>;
}

function Modal({ title, subtitle, onClose, children, wide }: {
  title: string; subtitle?: string; onClose: () => void; children: React.ReactNode; wide?: boolean;
}) {
  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box fade-in" style={{ maxWidth: wide ? 620 : 480 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', marginBottom: 3 }}>{title}</h2>
            {subtitle && <p style={{ fontSize: 12, color: 'var(--text3)' }}>{subtitle}</p>}
          </div>
          <button onClick={onClose} className="btn-ghost" style={{ padding: '5px 8px', marginLeft: 12 }}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M2 2l9 9M11 2l-9 9" strokeLinecap="round"/></svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function FormRow({ label, children }: { label: string; children: React.ReactNode }) {
  return <div style={{ marginBottom: 14 }}><label className="field-label">{label}</label>{children}</div>;
}

// ── New incident modal ────────────────────────────────────────────────────────
function NewIncidentModal({ caseId, onClose, onCreated }: {
  caseId?: string; onClose: () => void; onCreated: () => void;
}) {
  const cases = store.getCases().filter(c => c.status === 'active');
  const [selCase, setSelCase] = useState(caseId || cases[0]?.id || '');
  const [category, setCategory] = useState<SafeguardingCategory>('parental_behaviour');
  const [description, setDescription] = useState('');
  const [actionTaken, setActionTaken] = useState('');
  const [childrenInvolved, setChildrenInvolved] = useState('');
  const [followUp, setFollowUp] = useState('');

  const c = store.getCaseById(selCase);
  const children = (c?.persons || []).filter(p => p.role === 'child').map(p => p.name);

  function submit() {
    if (!description.trim() || !actionTaken.trim()) return;
    store.createSafeguardingIncident({
      case_id: selCase,
      category,
      description,
      immediate_action_taken: actionTaken,
      reported_by: 'Sarah Chen',
      children_involved: childrenInvolved ? childrenInvolved.split(',').map(s => s.trim()) : children,
      follow_up_actions: followUp ? followUp.split('\n').filter(Boolean) : [],
    });
    onCreated();
    onClose();
  }

  return (
    <Modal title="Log safeguarding incident" subtitle="This record is immutable and may be used in legal proceedings." onClose={onClose} wide>
      <div style={{ background: '#EF444410', border: '1px solid #EF444430', borderRadius: 8, padding: '10px 12px', marginBottom: 16, fontSize: 12, color: '#F87171' }}>
        ⚠ Safeguarding records are permanent and court-admissible. Your centre manager will be notified immediately.
      </div>

      {!caseId && (
        <FormRow label="Case">
          <select className="field" value={selCase} onChange={e => setSelCase(e.target.value)}>
            {cases.map(c => <option key={c.id} value={c.id}>{c.case_ref} — {c.family_name} family</option>)}
          </select>
        </FormRow>
      )}

      <FormRow label="Category">
        <select className="field" value={category} onChange={e => setCategory(e.target.value as SafeguardingCategory)}>
          {(Object.keys(categoryLabel) as SafeguardingCategory[]).map(k => (
            <option key={k} value={k}>{categoryLabel[k]}</option>
          ))}
        </select>
      </FormRow>

      <FormRow label="Children involved">
        <input className="field" value={childrenInvolved} onChange={e => setChildrenInvolved(e.target.value)}
          placeholder={children.join(', ') || 'Names of children involved'} />
      </FormRow>

      <FormRow label="Description of incident">
        <textarea className="field" style={{ minHeight: 100 }} value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Describe exactly what was observed or reported, with times where known..." />
      </FormRow>

      <FormRow label="Immediate action taken">
        <textarea className="field" style={{ minHeight: 80 }} value={actionTaken}
          onChange={e => setActionTaken(e.target.value)}
          placeholder="What action was taken immediately? Who was notified?" />
      </FormRow>

      <FormRow label="Follow-up actions required (one per line)">
        <textarea className="field" style={{ minHeight: 70 }} value={followUp}
          onChange={e => setFollowUp(e.target.value)}
          placeholder={`e.g. Notify social worker\nSuspend sessions pending review\nPrepare written report`} />
      </FormRow>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 12, borderTop: '1px solid var(--border)' }}>
        <button className="btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn-danger" onClick={submit}
          style={{ opacity: description.trim() && actionTaken.trim() ? 1 : 0.4 }}>
          Log incident
        </button>
      </div>
    </Modal>
  );
}

// ── Incident detail modal ─────────────────────────────────────────────────────
function IncidentDetailModal({ incident: initial, onClose, onUpdate }: {
  incident: SafeguardingIncident; onClose: () => void; onUpdate: () => void;
}) {
  const [review, setReview] = useState('');
  const [newStatus, setNewStatus] = useState<SafeguardingStatus>(initial.status);
  const [referralAgency, setReferralAgency] = useState(initial.referral_agency || '');
  const [referralRef, setReferralRef] = useState(initial.referral_ref || '');
  const [outcome, setOutcome] = useState(initial.outcome || '');
  const [saving, setSaving] = useState(false);

  const inc = store.getSafeguardingIncidents().find(i => i.id === initial.id) || initial;

  function save() {
    setSaving(true);
    store.updateSafeguardingStatus(inc.id, newStatus, review || undefined);
    onUpdate();
    setTimeout(() => { setSaving(false); onClose(); }, 400);
  }

  return (
    <Modal title="Safeguarding incident" subtitle={`${inc.family_name} family · ${categoryLabel[inc.category]}`} onClose={onClose} wide>
      {/* Header badges */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <Badge cls={statusBadge(inc.status)} label={statusLabel[inc.status]} />
        <Badge cls={categoryBadge(inc.category)} label={categoryLabel[inc.category]} />
        <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#3B82F6', alignSelf: 'center' }}>{inc.case_ref}</span>
      </div>

      {/* Core details */}
      <div className="card-sm" style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Reported by {inc.reported_by} · {formatDateTime(inc.reported_at)}</div>
        {inc.children_involved.length > 0 && (
          <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 8 }}>
            Children: {inc.children_involved.join(', ')}
          </div>
        )}
        <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.7, marginBottom: 10 }}>{inc.description}</div>
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Immediate action taken</div>
          <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.7 }}>{inc.immediate_action_taken}</div>
        </div>
      </div>

      {/* Follow-up actions */}
      {inc.follow_up_actions.length > 0 && (
        <div className="card-sm" style={{ marginBottom: 12 }}>
          <div className="section-label">Follow-up actions</div>
          {inc.follow_up_actions.map((a, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, padding: '5px 0', borderBottom: i < inc.follow_up_actions.length - 1 ? '1px solid var(--border)' : 'none', fontSize: 13, color: 'var(--text2)' }}>
              <span style={{ color: 'var(--text3)' }}>→</span> {a}
            </div>
          ))}
        </div>
      )}

      {/* Referral info */}
      {(inc.referral_agency || inc.referral_ref) && (
        <div className="card-sm" style={{ marginBottom: 12 }}>
          <div className="section-label">Referral details</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div><div style={{ fontSize: 11, color: 'var(--text3)' }}>Referred to</div><div style={{ fontSize: 13, color: 'var(--text)' }}>{inc.referral_agency || '—'}</div></div>
            <div><div style={{ fontSize: 11, color: 'var(--text3)' }}>Referral ref</div><div style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, color: '#3B82F6' }}>{inc.referral_ref || '—'}</div></div>
            {inc.referral_date && <div><div style={{ fontSize: 11, color: 'var(--text3)' }}>Date referred</div><div style={{ fontSize: 13, color: 'var(--text)' }}>{formatDate(inc.referral_date)}</div></div>}
          </div>
        </div>
      )}

      {/* Manager review */}
      {inc.manager_review && (
        <div className="card-sm" style={{ marginBottom: 12 }}>
          <div className="section-label">Manager review</div>
          <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.7, marginBottom: 6 }}>{inc.manager_review}</div>
          {inc.manager_reviewed_at && (
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>Reviewed {formatDateTime(inc.manager_reviewed_at)}</div>
          )}
        </div>
      )}

      {/* Manager actions */}
      {inc.status !== 'closed' && (
        <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: 14, marginBottom: 4 }}>
          <div className="section-label" style={{ marginBottom: 12 }}>Manager action</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div>
              <label className="field-label">Update status</label>
              <select className="field" value={newStatus} onChange={e => setNewStatus(e.target.value as SafeguardingStatus)}>
                <option value="open">Open</option>
                <option value="referred">Referred to agency</option>
                <option value="monitoring">Monitoring</option>
                <option value="closed">Close incident</option>
              </select>
            </div>
            <div>
              <label className="field-label">Referral agency (if applicable)</label>
              <input className="field" value={referralAgency} onChange={e => setReferralAgency(e.target.value)} placeholder="e.g. Hampshire CC Children's Services" />
            </div>
          </div>
          <div style={{ marginBottom: 10 }}>
            <label className="field-label">Manager review notes</label>
            <textarea className="field" style={{ minHeight: 70 }} value={review}
              onChange={e => setReview(e.target.value)}
              placeholder="Add your review, decisions made, and any further actions..." />
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 12, borderTop: '1px solid var(--border)' }}>
        <button className="btn-ghost" onClick={onClose}>Close</button>
        {inc.status !== 'closed' && (
          <button className="btn-primary" onClick={save} style={{ opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Saving...' : 'Save update'}
          </button>
        )}
      </div>
    </Modal>
  );
}

// ── Main safeguarding page ────────────────────────────────────────────────────
export default function SafeguardingPage({ caseId }: { caseId?: string }) {
  const [showNew, setShowNew] = useState(false);
  const [viewing, setViewing] = useState<SafeguardingIncident | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [refresh, setRefresh] = useState(0);
  const bump = () => setRefresh(r => r + 1);

  const all = caseId
    ? store.getSafeguardingByCase(caseId)
    : store.getSafeguardingIncidents();

  const filtered = all.filter(i => statusFilter === 'all' || i.status === statusFilter);
  const open = all.filter(i => i.status === 'open').length;
  const referred = all.filter(i => i.status === 'referred').length;

  return (
    <div className="fade-in">
      {showNew && <NewIncidentModal caseId={caseId} onClose={() => setShowNew(false)} onCreated={bump} />}
      {viewing && <IncidentDetailModal incident={viewing} onClose={() => { setViewing(null); bump(); }} onUpdate={bump} />}

      {/* Open incident banner */}
      {open > 0 && (
        <div style={{ background: '#EF444408', border: '1px solid #EF444430', borderRadius: 10, padding: '14px 18px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 34, height: 34, borderRadius: 8, background: '#EF444420', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#F87171', fontSize: 18, flexShrink: 0 }}>⚠</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>
              {open} open safeguarding incident{open !== 1 ? 's' : ''} requiring action
            </div>
            <div style={{ fontSize: 12, color: 'var(--text2)' }}>
              These must be reviewed by a manager. Unresolved incidents block session scheduling.
            </div>
          </div>
        </div>
      )}

      {/* Metrics */}
      {!caseId && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 18 }}>
          {[
            { label: 'Total incidents', value: all.length },
            { label: 'Open', value: open, color: open > 0 ? '#EF4444' : undefined },
            { label: 'Referred', value: referred, color: referred > 0 ? '#F59E0B' : undefined },
            { label: 'Closed', value: all.filter(i => i.status === 'closed').length, color: '#10B981' },
          ].map(m => (
            <div key={m.label} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px' }}>
              <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 6 }}>{m.label}</div>
              <div style={{ fontSize: 28, fontWeight: 600, color: m.color || 'var(--text)', lineHeight: 1 }}>{m.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
          <span className="section-label" style={{ marginBottom: 0 }}>Safeguarding incidents</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <select className="field" style={{ width: 160, padding: '5px 10px', fontSize: 12 }}
              value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="all">All statuses</option>
              <option value="open">Open</option>
              <option value="referred">Referred</option>
              <option value="monitoring">Monitoring</option>
              <option value="closed">Closed</option>
            </select>
            <button className="btn-danger" style={{ fontSize: 12 }} onClick={() => setShowNew(true)}>
              ⚠ Log incident
            </button>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center' }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>✓</div>
            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)', marginBottom: 4 }}>No incidents logged</div>
            <div style={{ fontSize: 13, color: 'var(--text3)' }}>
              {statusFilter === 'all' ? 'No safeguarding incidents have been recorded.' : `No ${statusFilter} incidents.`}
            </div>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                {!caseId && <th>Case</th>}
                <th>Category</th>
                <th>Children</th>
                <th>Reported by</th>
                <th>Status</th>
                <th>Referral</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(inc => (
                <tr key={inc.id} onClick={() => setViewing(inc)}>
                  <td>
                    <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 11 }}>{formatDate(inc.reported_at)}</div>
                    <div style={{ fontSize: 10, color: 'var(--text3)' }}>{new Date(inc.reported_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</div>
                  </td>
                  {!caseId && (
                    <td>
                      <div>{inc.family_name} family</div>
                      <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#3B82F6' }}>{inc.case_ref}</div>
                    </td>
                  )}
                  <td><Badge cls={categoryBadge(inc.category)} label={categoryLabel[inc.category]} /></td>
                  <td style={{ color: 'var(--text3)', fontSize: 12 }}>{inc.children_involved.join(', ') || '—'}</td>
                  <td style={{ color: 'var(--text3)' }}>{inc.reported_by}</td>
                  <td><Badge cls={statusBadge(inc.status)} label={statusLabel[inc.status]} /></td>
                  <td style={{ color: 'var(--text3)', fontSize: 12 }}>{inc.referral_agency || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

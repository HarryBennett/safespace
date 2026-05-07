'use client';
import { useState } from 'react';
import { store, ShareLink, ShareScope, RecipientRole } from '@/lib/store';
import {
  recipientRoleLabel, shareLinkStatusBadge, shareLinkStatusLabel,
  formatDateTime, formatDate, daysUntil, auditEventLabel, auditEventColor,
  sessionTypeLabel, noteTypeLabel, noteTypeBadge, caseStatusBadge, formatTime
} from '@/lib/ui';

// ── Icons ─────────────────────────────────────────────────────────────────────
const Ico = {
  x: <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M2 2l9 9M11 2l-9 9" strokeLinecap="round"/></svg>,
  check: <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2.5 7.5l3.5 3.5 5.5-6" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  copy: <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.4"><rect x="4" y="4" width="8" height="8" rx="1"/><path d="M4 4V2a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H9"/></svg>,
  eye: <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M1 6.5C2.5 3 4.8 1.5 6.5 1.5s4 1.5 5.5 5c-1.5 3.5-3.8 5-5.5 5S2.5 10 1 6.5z"/><circle cx="6.5" cy="6.5" r="1.5"/></svg>,
  ban: <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.4"><circle cx="6.5" cy="6.5" r="5"/><path d="M3 3l7 7" strokeLinecap="round"/></svg>,
  plus: <svg width="13" height="13" viewBox="0 0 13 13" fill="currentColor"><path d="M6.5 1v11M1 6.5h11"/></svg>,
  clock: <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.3"><circle cx="6" cy="6" r="5"/><path d="M6 3.5V6.5l2 1" strokeLinecap="round"/></svg>,
  warn: <svg width="13" height="13" viewBox="0 0 13 13" fill="currentColor"><path d="M6.5 1L13 12H0L6.5 1zm0 4v3.5M6.5 10.5v.5"/></svg>,
  link: <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M5 8l3-3M7.5 2.5l1.5-1.5a2.5 2.5 0 013.5 3.5L11 6M6 7L4.5 8.5a2.5 2.5 0 01-3.5-3.5L2.5 3.5" strokeLinecap="round"/></svg>,
  doc: <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><path d="M2 1a1 1 0 011-1h4.586a1 1 0 01.707.293L10.707 2.707A1 1 0 0111 3.414V11a1 1 0 01-1 1H3a1 1 0 01-1-1V1zm2 4h5v1H4V5zm0 2h5v1H4V7zm0 2h3v1H4V9z"/></svg>,
  back: <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 3L5 7l4 4" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  shield: <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M7 1l5 2v4c0 3-2.5 5.5-5 6C4.5 12.5 2 10 2 7V3L7 1z"/></svg>,
};

function Badge({ cls, label }: { cls: string; label: string }) {
  return <span className={`badge ${cls}`}>{label}</span>;
}

function Modal({ title, subtitle, onClose, children, wide }: { title: string; subtitle?: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box fade-in" style={{ maxWidth: wide ? 620 : 480 }}>
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

// ── New Share Link Modal ───────────────────────────────────────────────────────
function NewShareLinkModal({ caseId, onClose, onCreated }: { caseId?: string; onClose: () => void; onCreated: () => void }) {
  const cases = store.getCases().filter(c => c.status === 'active');
  const [step, setStep] = useState<'form' | 'confirm' | 'done'>('form');
  const [form, setForm] = useState({
    case_id: caseId || cases[0]?.id || '',
    recipient_name: '', recipient_email: '', recipient_role: 'social_worker' as RecipientRole,
    purpose: '', expires_days: 14,
    include_notes: 'all' as ShareScope['include_notes'],
    include_documents: false, include_recordings: false,
    session_ids: [] as string[],
  });

  const selectedCase = cases.find(c => c.id === form.case_id);
  const caseSessions = store.getSessionsByCase(form.case_id);

  function toggleSession(id: string) {
    setForm(p => ({ ...p, session_ids: p.session_ids.includes(id) ? p.session_ids.filter(x => x !== id) : [...p.session_ids, id] }));
  }

  function submit() {
    store.createShareLink({
      case_id: form.case_id, recipient_name: form.recipient_name,
      recipient_email: form.recipient_email, recipient_role: form.recipient_role,
      scope: { session_ids: form.session_ids, include_notes: form.include_notes, include_documents: form.include_documents, include_recordings: form.include_recordings },
      purpose: form.purpose, expires_days: form.expires_days, created_by: 'Sarah Chen',
    });
    onCreated();
    setStep('done');
  }

  const canProceed = form.recipient_name && form.recipient_email && form.purpose && form.session_ids.length > 0;

  if (step === 'done') {
    return (
      <Modal title="Share link created" onClose={onClose}>
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#F59E0B20', border: '1px solid #F59E0B40', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', fontSize: 22 }}>⏳</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>Awaiting manager approval</div>
          <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6, marginBottom: 20 }}>Your request has been submitted. A manager will review and approve before the link is sent to <strong style={{ color: 'var(--text)' }}>{form.recipient_email}</strong>.</div>
          <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: '12px 14px', fontSize: 12, color: 'var(--text3)', textAlign: 'left' }}>
            <div>📋 Case: <span style={{ color: 'var(--text)' }}>{selectedCase?.case_ref} — {selectedCase?.family_name} family</span></div>
            <div style={{ marginTop: 4 }}>📧 Recipient: <span style={{ color: 'var(--text)' }}>{form.recipient_name} · {form.recipient_email}</span></div>
            <div style={{ marginTop: 4 }}>⏱ Expires in: <span style={{ color: 'var(--text)' }}>{form.expires_days} days</span></div>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 12, borderTop: '1px solid var(--border)' }}>
          <button className="btn-primary" onClick={onClose}>Done</button>
        </div>
      </Modal>
    );
  }

  if (step === 'confirm') {
    return (
      <Modal title="Confirm share request" subtitle="Review before requesting manager approval." onClose={onClose} wide>
        <div style={{ background: '#F59E0B08', border: '1px solid #F59E0B30', borderRadius: 8, padding: '12px 14px', fontSize: 13, color: '#FBBF24', marginBottom: 16, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <span>{Ico.warn}</span>
          <div>Manager countersignature required. Once approved, <strong>{form.recipient_email}</strong> will receive a secure link by email. All access will be logged and attributed.</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
          <div className="card-sm"><div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Recipient</div><div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{form.recipient_name}</div><div style={{ fontSize: 12, color: 'var(--text2)' }}>{form.recipient_email}</div><div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>{recipientRoleLabel[form.recipient_role]}</div></div>
          <div className="card-sm"><div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Case</div><div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{selectedCase?.family_name} family</div><div style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#3B82F6' }}>{selectedCase?.case_ref}</div><div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>Expires in {form.expires_days} days</div></div>
        </div>
        <div className="card-sm" style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6 }}>Sharing scope</div>
          <div style={{ fontSize: 13, color: 'var(--text)', marginBottom: 4 }}>Sessions: <span style={{ color: 'var(--text2)' }}>{form.session_ids.length} selected</span></div>
          <div style={{ fontSize: 13, color: 'var(--text)', marginBottom: 4 }}>Notes: <span style={{ color: 'var(--text2)' }}>{form.include_notes === 'all' ? 'All notes' : form.include_notes === 'welfare_concern' ? 'Welfare concerns only' : form.include_notes === 'observation' ? 'Observations only' : 'No notes'}</span></div>
          <div style={{ fontSize: 13, color: 'var(--text)', marginBottom: 4 }}>Documents: <span style={{ color: 'var(--text2)' }}>{form.include_documents ? 'Included' : 'Not included'}</span></div>
          <div style={{ fontSize: 13, color: 'var(--text)' }}>Recordings: <span style={{ color: 'var(--text2)' }}>{form.include_recordings ? 'Stream only' : 'Not included'}</span></div>
        </div>
        <div className="card-sm" style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Purpose / reason for sharing</div>
          <div style={{ fontSize: 13, color: 'var(--text)' }}>{form.purpose}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 12, borderTop: '1px solid var(--border)' }}>
          <button className="btn-ghost" onClick={() => setStep('form')}>Back</button>
          <button className="btn-primary" onClick={submit}>Request manager approval →</button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Generate secure share link" subtitle="Select exactly what to share. Manager approval required before the link is sent." onClose={onClose} wide>
      {!caseId && (
        <FormRow label="Case">
          <select className="field" value={form.case_id} onChange={e => { setForm(p => ({ ...p, case_id: e.target.value, session_ids: [] })); }}>
            {cases.map(c => <option key={c.id} value={c.id}>{c.case_ref} — {c.family_name} family</option>)}
          </select>
        </FormRow>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <FormRow label="Recipient name"><input className="field" value={form.recipient_name} onChange={e => setForm(p => ({ ...p, recipient_name: e.target.value }))} placeholder="e.g. Kate Bridges" /></FormRow>
        <FormRow label="Professional email"><input className="field" type="email" value={form.recipient_email} onChange={e => setForm(p => ({ ...p, recipient_email: e.target.value }))} placeholder="name@organisation.gov.uk" /></FormRow>
      </div>
      <FormRow label="Recipient role">
        <select className="field" value={form.recipient_role} onChange={e => setForm(p => ({ ...p, recipient_role: e.target.value as RecipientRole }))}>
          <option value="social_worker">Social worker</option>
          <option value="cafcass">Cafcass officer</option>
          <option value="solicitor">Solicitor / barrister</option>
          <option value="court">Court</option>
          <option value="other">Other professional</option>
        </select>
      </FormRow>
      <div style={{ marginBottom: 14 }}>
        <label className="field-label">Sessions to share ({form.session_ids.length} selected)</label>
        <div style={{ maxHeight: 160, overflowY: 'auto', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: 8 }}>
          {caseSessions.length === 0 && <div style={{ fontSize: 13, color: 'var(--text3)', padding: 8 }}>No sessions for this case yet.</div>}
          {caseSessions.map(s => (
            <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 8px', borderRadius: 6, cursor: 'pointer', marginBottom: 3, background: form.session_ids.includes(s.id) ? 'rgba(59,130,246,0.1)' : 'transparent' }}>
              <input type="checkbox" checked={form.session_ids.includes(s.id)} onChange={() => toggleSession(s.id)} style={{ accentColor: '#3B82F6' }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)' }}>{formatDate(s.scheduled_start)} · {formatTime(s.scheduled_start)}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>{sessionTypeLabel[s.session_type]} · {s.room} · {s.supervisor}</div>
              </div>
              <Badge cls={s.status === 'completed' ? 'bg-blue-900/30 text-blue-300 border border-blue-800/40' : 'bg-slate-700/40 text-slate-300 border border-slate-600/30'} label={s.status} />
            </label>
          ))}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <FormRow label="Include notes">
          <select className="field" value={form.include_notes} onChange={e => setForm(p => ({ ...p, include_notes: e.target.value as any }))}>
            <option value="all">All notes</option>
            <option value="welfare_concern">Welfare concerns only</option>
            <option value="observation">Observations only</option>
            <option value="none">No notes</option>
          </select>
        </FormRow>
        <FormRow label="Link expires after">
          <select className="field" value={form.expires_days} onChange={e => setForm(p => ({ ...p, expires_days: Number(e.target.value) }))}>
            <option value={7}>7 days</option>
            <option value={14}>14 days</option>
            <option value={30}>30 days (maximum)</option>
          </select>
        </FormRow>
      </div>
      <div style={{ display: 'flex', gap: 16, marginBottom: 14 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text2)', cursor: 'pointer' }}>
          <input type="checkbox" checked={form.include_documents} onChange={e => setForm(p => ({ ...p, include_documents: e.target.checked }))} style={{ accentColor: '#3B82F6' }} />
          Include documents
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text2)', cursor: 'pointer' }}>
          <input type="checkbox" checked={form.include_recordings} onChange={e => setForm(p => ({ ...p, include_recordings: e.target.checked }))} style={{ accentColor: '#3B82F6' }} />
          Include recordings (stream only)
        </label>
      </div>
      <FormRow label="Purpose / reason for sharing (required)">
        <textarea className="field" style={{ minHeight: 72 }} value={form.purpose} onChange={e => setForm(p => ({ ...p, purpose: e.target.value }))} placeholder="e.g. Court hearing 20 May — judge requested session reports 1–9" />
      </FormRow>
      <div style={{ background: '#F59E0B08', border: '1px solid #F59E0B30', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: '#FBBF24', marginBottom: 14 }}>
        {Ico.warn} Manager countersignature required before the link is sent. Nothing will be shared until a manager approves.
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 12, borderTop: '1px solid var(--border)' }}>
        <button className="btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={() => canProceed && setStep('confirm')} style={{ opacity: canProceed ? 1 : 0.45 }}>Review & submit →</button>
      </div>
    </Modal>
  );
}

// ── Approval Modal ─────────────────────────────────────────────────────────────
function ApprovalModal({ link, onClose, onDone }: { link: ShareLink; onClose: () => void; onDone: () => void }) {
  const [action, setAction] = useState<'idle' | 'reject'>('idle');
  const [reason, setReason] = useState('');
  const sessions = store.getSessionsByCase(link.case_id).filter(s => link.scope.session_ids.includes(s.id));
  const c = store.getCaseById(link.case_id);

  function approve() { store.approveShareLink(link.id, 'Director J. Walsh'); onDone(); onClose(); }
  function reject() { if (!reason.trim()) return; store.rejectShareLink(link.id, 'Director J. Walsh', reason); onDone(); onClose(); }

  return (
    <Modal title="Review share request" subtitle="Approve or reject this sharing request." onClose={onClose} wide>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
        <div className="card-sm">
          <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Requested by</div>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{link.created_by}</div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{formatDateTime(link.created_at)}</div>
        </div>
        <div className="card-sm">
          <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Recipient</div>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{link.recipient_name}</div>
          <div style={{ fontSize: 12, color: 'var(--text2)' }}>{link.recipient_email}</div>
          <div style={{ fontSize: 11, color: 'var(--text3)' }}>{recipientRoleLabel[link.recipient_role]}</div>
        </div>
      </div>
      <div className="card-sm" style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 8 }}>Case: {c?.case_ref} — {c?.family_name} family</div>
        <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6 }}>Sessions to share</div>
        {sessions.map(s => (
          <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '4px 0', borderBottom: '1px solid var(--border)', color: 'var(--text2)' }}>
            <span>{formatDate(s.scheduled_start)} · {sessionTypeLabel[s.session_type]}</span>
            <span style={{ color: 'var(--text3)' }}>{s.notes.length} notes</span>
          </div>
        ))}
        <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text2)' }}>
          Notes: {link.scope.include_notes === 'all' ? 'All notes' : link.scope.include_notes + ' only'} · 
          Documents: {link.scope.include_documents ? 'Yes' : 'No'} · 
          Expires: {formatDate(link.expires_at)}
        </div>
      </div>
      <div className="card-sm" style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Purpose stated by requester</div>
        <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6 }}>{link.purpose}</div>
      </div>
      {action === 'reject' && (
        <div style={{ marginBottom: 14 }}>
          <label className="field-label">Reason for rejection (required)</label>
          <textarea className="field" style={{ minHeight: 72 }} value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Insufficient scope — please limit to sessions 5–9 only" />
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 12, borderTop: '1px solid var(--border)' }}>
        <button className="btn-ghost" onClick={onClose}>Cancel</button>
        {action === 'idle' && <>
          <button className="btn-danger" onClick={() => setAction('reject')}>Reject</button>
          <button className="btn-primary" onClick={approve}>{Ico.check} Approve & send link</button>
        </>}
        {action === 'reject' && <>
          <button className="btn-ghost" onClick={() => setAction('idle')}>Back</button>
          <button className="btn-danger" onClick={reject} style={{ opacity: reason.trim() ? 1 : 0.4 }}>Confirm rejection</button>
        </>}
      </div>
    </Modal>
  );
}

// ── Link detail / audit modal ─────────────────────────────────────────────────
function LinkDetailModal({ link, onClose, onRevoke, onRefresh }: { link: ShareLink; onClose: () => void; onRevoke: () => void; onRefresh: () => void }) {
  const [copied, setCopied] = useState(false);
  const portalUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/portal/${link.token}`;

  function copyLink() {
    navigator.clipboard.writeText(portalUrl).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function revoke() {
    store.revokeShareLink(link.id, 'Sarah Chen');
    onRevoke();
    onRefresh();
    onClose();
  }

  const days = daysUntil(link.expires_at);

  return (
    <Modal title="Share link details" subtitle={`${link.family_name} family → ${link.recipient_name}`} onClose={onClose} wide>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
        <div className="card-sm">
          <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 2 }}>Recipient</div>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{link.recipient_name}</div>
          <div style={{ fontSize: 12, color: 'var(--text2)' }}>{link.recipient_email}</div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{recipientRoleLabel[link.recipient_role]}</div>
        </div>
        <div className="card-sm">
          <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 2 }}>Status</div>
          <div style={{ marginBottom: 4 }}><Badge cls={shareLinkStatusBadge(link.status)} label={shareLinkStatusLabel(link.status)} /></div>
          {link.status === 'active' && <div style={{ fontSize: 11, color: days <= 3 ? '#F87171' : 'var(--text3)' }}>{days > 0 ? `Expires in ${days} days` : 'Expired'}</div>}
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>Viewed {link.view_count}×</div>
        </div>
      </div>

      {link.status === 'active' && (
        <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#3B82F6', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{portalUrl}</span>
          <button className="btn-ghost" style={{ padding: '5px 10px', fontSize: 12, flexShrink: 0 }} onClick={copyLink}>{copied ? Ico.check : Ico.copy} {copied ? 'Copied!' : 'Copy'}</button>
          <a href={`/portal/${link.token}`} target="_blank" rel="noopener noreferrer" className="btn-ghost" style={{ padding: '5px 10px', fontSize: 12, textDecoration: 'none', flexShrink: 0 }}>{Ico.eye} Preview portal</a>
        </div>
      )}

      <div className="card-sm" style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6 }}>Purpose</div>
        <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6 }}>{link.purpose}</div>
        {link.approved_by && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6 }}>Approved by {link.approved_by} · {link.approved_at && formatDateTime(link.approved_at)}</div>}
      </div>

      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>Audit log</div>
        <div style={{ maxHeight: 180, overflowY: 'auto' }}>
          {link.audit_log.map((entry, i) => (
            <div key={entry.id} style={{ display: 'flex', gap: 10, paddingBottom: 8, marginBottom: 8, borderBottom: i < link.audit_log.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: auditEventColor(entry.event), marginTop: 4, flexShrink: 0 }}></div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)' }}>{auditEventLabel(entry.event)}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>{entry.actor}{entry.ip ? ` · IP ${entry.ip}` : ''} · {formatDateTime(entry.created_at)}</div>
                {entry.detail && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{entry.detail}</div>}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', paddingTop: 12, borderTop: '1px solid var(--border)' }}>
        {link.status === 'active' && <button className="btn-danger" onClick={revoke}>{Ico.ban} Revoke link</button>}
        <div style={{ marginLeft: 'auto' }}><button className="btn-ghost" onClick={onClose}>Close</button></div>
      </div>
    </Modal>
  );
}

// ── Main Sharing Page ─────────────────────────────────────────────────────────
export default function SharingPage({ caseId, onBack }: { caseId?: string; onBack?: () => void }) {
  const [showNewLink, setShowNewLink] = useState(false);
  const [approving, setApproving] = useState<ShareLink | null>(null);
  const [viewing, setViewing] = useState<ShareLink | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [refresh, setRefresh] = useState(0);
  const bump = () => setRefresh(r => r + 1);

  const allLinks = caseId ? store.getShareLinksByCase(caseId) : store.getShareLinks();
  const pending = store.getPendingApprovals();
  const filtered = allLinks.filter(l => statusFilter === 'all' || l.status === statusFilter);

  return (
    <div className="fade-in">
      {showNewLink && <NewShareLinkModal caseId={caseId} onClose={() => setShowNewLink(false)} onCreated={bump} />}
      {approving && <ApprovalModal link={approving} onClose={() => setApproving(null)} onDone={bump} />}
      {viewing && <LinkDetailModal link={viewing} onClose={() => setViewing(null)} onRevoke={bump} onRefresh={bump} />}

      {onBack && <button className="btn-ghost" style={{ marginBottom: 14, fontSize: 12 }} onClick={onBack}>{Ico.back} Back</button>}

      {/* Pending approvals banner */}
      {pending.length > 0 && (
        <div style={{ background: '#F59E0B08', border: '1px solid #F59E0B30', borderRadius: 10, padding: '14px 18px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 34, height: 34, borderRadius: 8, background: '#F59E0B20', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#F59E0B', flexShrink: 0 }}>{Ico.warn}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>{pending.length} share request{pending.length > 1 ? 's' : ''} awaiting approval</div>
            <div style={{ fontSize: 12, color: 'var(--text2)' }}>No links will be sent until a manager approves. Click to review.</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {pending.slice(0, 2).map(p => (
              <button key={p.id} className="btn-primary" style={{ fontSize: 12, padding: '6px 12px' }} onClick={() => setApproving(p)}>
                Review — {p.family_name} family
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 18 }}>
        {[
          { label: 'Total links', value: allLinks.length },
          { label: 'Active', value: allLinks.filter(l => l.status === 'active').length, color: '#10B981' },
          { label: 'Pending approval', value: pending.length, color: pending.length > 0 ? '#F59E0B' : undefined },
          { label: 'Total accesses', value: allLinks.reduce((a, l) => a + l.view_count, 0), color: '#3B82F6' },
        ].map(m => (
          <div key={m.label} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 6 }}>{m.label}</div>
            <div style={{ fontSize: 28, fontWeight: 600, color: m.color || 'var(--text)', lineHeight: 1 }}>{m.value}</div>
          </div>
        ))}
      </div>

      {/* Security notice */}
      <div style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, display: 'flex', gap: 10, alignItems: 'center', fontSize: 12, color: '#93C5FD' }}>
        <span style={{ flexShrink: 0 }}>{Ico.shield}</span>
        Every link access is logged with IP address, timestamp, and user attribution. Logs are immutable and court-admissible. External recipients can only view — never download recordings.
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
          <span className="section-label" style={{ marginBottom: 0 }}>Share links</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <select className="field" style={{ width: 160, padding: '5px 10px', fontSize: 12 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="pending_approval">Pending approval</option>
              <option value="expired">Expired</option>
              <option value="revoked">Revoked</option>
            </select>
            <button className="btn-primary" style={{ fontSize: 12 }} onClick={() => setShowNewLink(true)}>{Ico.plus} New share link</button>
          </div>
        </div>
        <table className="data-table">
          <thead><tr><th>Recipient</th><th>Role</th><th>Case</th><th>Scope</th><th>Expires</th><th>Views</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {filtered.map(l => {
              const days = daysUntil(l.expires_at);
              return (
                <tr key={l.id} onClick={() => setViewing(l)}>
                  <td>
                    <div>{l.recipient_name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>{l.recipient_email}</div>
                  </td>
                  <td style={{ color: 'var(--text3)' }}>{recipientRoleLabel[l.recipient_role]}</td>
                  <td><span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#3B82F6' }}>{l.case_ref}</span></td>
                  <td style={{ color: 'var(--text3)', fontSize: 12 }}>
                    {l.scope.session_ids.length} session{l.scope.session_ids.length !== 1 ? 's' : ''} · {l.scope.include_notes === 'all' ? 'all notes' : l.scope.include_notes === 'none' ? 'no notes' : l.scope.include_notes.replace('_', ' ')}
                    {l.scope.include_documents ? ' · docs' : ''}
                  </td>
                  <td>
                    <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: l.status === 'active' && days <= 3 ? '#F87171' : 'var(--text3)' }}>
                      {formatDate(l.expires_at)}
                    </div>
                    {l.status === 'active' && <div style={{ fontSize: 10, color: days <= 3 ? '#F87171' : 'var(--text3)' }}>{days > 0 ? `${days}d remaining` : 'expired'}</div>}
                  </td>
                  <td style={{ color: 'var(--text3)' }}>{l.view_count}</td>
                  <td><Badge cls={shareLinkStatusBadge(l.status)} label={shareLinkStatusLabel(l.status)} /></td>
                  <td onClick={e => e.stopPropagation()}>
                    {l.approval_status === 'pending' && (
                      <button className="btn-primary" style={{ padding: '4px 10px', fontSize: 11 }} onClick={() => setApproving(l)}>Review</button>
                    )}
                    {l.status === 'active' && (
                      <div style={{ display: 'flex', gap: 4 }}>
                        <a href={`/portal/${l.token}`} target="_blank" rel="noopener noreferrer" className="btn-ghost" style={{ padding: '4px 8px', fontSize: 11, textDecoration: 'none' }}>{Ico.eye}</a>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--text3)', padding: '28px' }}>No share links match this filter.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

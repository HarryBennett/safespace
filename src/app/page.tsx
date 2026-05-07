'use client';
import { useState, useEffect, useCallback } from 'react';
import { store, storeExt, Case, Session, Note } from '@/lib/store';
import SharingPage from '@/components/SharingPage';
import BillingPage from '@/components/BillingPage';
import SafeguardingPage from '@/components/SafeguardingPage';
import NACCCPage from '@/components/NACCCPage';
import WaitingListPage from '@/components/WaitingListPage';
import CommLogPage from '@/components/CommLogPage';
import SessionFeedbackForm from '@/components/SessionFeedbackForm';
import GmailPage, { ComposeEmailModal } from '@/components/GmailPage';
import RotaPage from '@/components/RotaPage';
import CallsPage, { CaseCallLog } from '@/components/CallsPage';
import ContactNumberManager from '@/components/ContactNumberManager';
import {
  sessionTypeBadge, sessionStatusBadge, caseStatusBadge, noteTypeBadge,
  riskFlagLabel, referralLabel, sessionTypeLabel, sessionStatusLabel, noteTypeLabel,
  formatDateTime, formatDate, formatTime, ageFromDob
} from '@/lib/ui';

const Icon = {
  grid: <svg width="15" height="15" viewBox="0 0 15 15" fill="currentColor"><rect x="1" y="1" width="5.5" height="5.5" rx="1"/><rect x="8.5" y="1" width="5.5" height="5.5" rx="1"/><rect x="1" y="8.5" width="5.5" height="5.5" rx="1"/><rect x="8.5" y="8.5" width="5.5" height="5.5" rx="1"/></svg>,
  folder: <svg width="15" height="15" viewBox="0 0 15 15" fill="currentColor"><path d="M1 3a1 1 0 011-1h4.586a1 1 0 01.707.293L8.707 3.707A1 1 0 009.414 4H13a1 1 0 011 1v7a1 1 0 01-1 1H2a1 1 0 01-1-1V3z"/></svg>,
  clock: <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4"><circle cx="7.5" cy="7.5" r="6"/><path d="M7.5 4.5v3.5l2.5 1.5" strokeLinecap="round"/></svg>,
  chart: <svg width="15" height="15" viewBox="0 0 15 15" fill="currentColor"><path d="M1 1h2v13H1V1zm4 4h2v9H5V5zm4-3h2v12H9V2zm4 5h2v7h-2V7z"/></svg>,
  plus: <svg width="13" height="13" viewBox="0 0 13 13" fill="currentColor"><path d="M6.5 1v11M1 6.5h11"/></svg>,
  back: <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 3L5 7l4 4" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  doc: <svg width="13" height="13" viewBox="0 0 13 13" fill="currentColor"><path d="M2 1a1 1 0 011-1h5.586a1 1 0 01.707.293L11.707 2.707A1 1 0 0112 3.414V12a1 1 0 01-1 1H3a1 1 0 01-1-1V1zm2 5h6v1H4V6zm0 2.5h6v1H4v-1zm0 2.5h4v1H4V11z"/></svg>,
  live: <svg width="8" height="8" viewBox="0 0 8 8" fill="#F87171"><circle cx="4" cy="4" r="4"/></svg>,
  x: <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M2 2l9 9M11 2l-9 9" strokeLinecap="round"/></svg>,
  upload: <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6.5 8.5V2M4 4.5L6.5 2 9 4.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M1 9.5v1.5a1 1 0 001 1h9a1 1 0 001-1V9.5" strokeLinecap="round"/></svg>,
};

function Badge({ cls, label }: { cls: string; label: string }) {
  return <span className={`badge ${cls}`}>{label}</span>;
}

function Modal({ title, subtitle, onClose, children }: { title: string; subtitle?: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box fade-in">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', marginBottom: 3 }}>{title}</h2>
            {subtitle && <p style={{ fontSize: 12, color: 'var(--text3)' }}>{subtitle}</p>}
          </div>
          <button onClick={onClose} className="btn-ghost" style={{ padding: '5px 8px', marginLeft: 12 }}>{Icon.x}</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function FormRow({ label, children }: { label: string; children: React.ReactNode }) {
  return <div style={{ marginBottom: 14 }}><label className="field-label">{label}</label>{children}</div>;
}

function Metric({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px' }}>
      <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 600, color: color || 'var(--text)', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function NewCaseModal({ onClose, onCreate }: { onClose: () => void; onCreate: (c: Case) => void }) {
  const [form, setForm] = useState({ family_name: '', referral_source: 'local_authority', keyworker: 'Sarah Chen', legal_order_ref: '', social_worker: '', cafcass_officer: '', risk_flags: [] as string[] });
  const flags = ['domestic_violence','court_injunction','safeguarding','legal_proceedings','prohibited_steps_order'] as const;
  function toggle(f: string) { setForm(p => ({ ...p, risk_flags: p.risk_flags.includes(f) ? p.risk_flags.filter(x => x !== f) : [...p.risk_flags, f] })); }
  function submit() {
    if (!form.family_name.trim()) return;
    onCreate(store.createCase({ ...form, referral_source: form.referral_source as any, risk_flags: form.risk_flags as any }));
    onClose();
  }
  return (
    <Modal title="New referral intake" subtitle="A case reference will be auto-generated." onClose={onClose}>
      <FormRow label="Family name"><input className="field" value={form.family_name} onChange={e => setForm(p => ({...p, family_name: e.target.value}))} placeholder="e.g. Smith family" /></FormRow>
      <FormRow label="Referral source"><select className="field" value={form.referral_source} onChange={e => setForm(p => ({...p, referral_source: e.target.value as any}))}><option value="local_authority">Local authority</option><option value="private">Private</option><option value="cafcass">Cafcass</option><option value="court_ordered">Court ordered</option></select></FormRow>
      <FormRow label="Keyworker"><select className="field" value={form.keyworker} onChange={e => setForm(p => ({...p, keyworker: e.target.value}))}><option>Sarah Chen</option><option>James Okafor</option><option>Maria Torres</option></select></FormRow>
      <FormRow label="Risk flags">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
          {flags.map(f => <label key={f} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text2)', cursor: 'pointer' }}><input type="checkbox" checked={form.risk_flags.includes(f)} onChange={() => toggle(f)} style={{ accentColor: '#3B82F6' }} />{riskFlagLabel[f]}</label>)}
        </div>
      </FormRow>
      <FormRow label="Court order ref (optional)"><input className="field" value={form.legal_order_ref} onChange={e => setForm(p => ({...p, legal_order_ref: e.target.value}))} placeholder="e.g. WN/2026/FC/00841" /></FormRow>
      <FormRow label="Social worker"><input className="field" value={form.social_worker} onChange={e => setForm(p => ({...p, social_worker: e.target.value}))} placeholder="Name and LA" /></FormRow>
      <FormRow label="Cafcass officer"><input className="field" value={form.cafcass_officer} onChange={e => setForm(p => ({...p, cafcass_officer: e.target.value}))} /></FormRow>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 12, borderTop: '1px solid var(--border)' }}>
        <button className="btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={submit}>{Icon.plus} Create case</button>
      </div>
    </Modal>
  );
}

function NewSessionModal({ cases, onClose, onCreate }: { cases: Case[]; onClose: () => void; onCreate: () => void }) {
  const today = new Date().toISOString().split('T')[0];
  const [f, setF] = useState({ case_id: cases[0]?.id || '', session_type: 'supervised', date: today, start_time: '10:00', end_time: '11:00', supervisor: 'Sarah Chen', room: 'Room A' });
  function submit() {
    store.createSession({ case_id: f.case_id, session_type: f.session_type as any, scheduled_start: `${f.date}T${f.start_time}:00`, scheduled_end: `${f.date}T${f.end_time}:00`, supervisor: f.supervisor, room: f.room });
    onCreate(); onClose();
  }
  return (
    <Modal title="Schedule session" onClose={onClose}>
      <FormRow label="Case"><select className="field" value={f.case_id} onChange={e => setF(p => ({...p, case_id: e.target.value}))}>{cases.map(c => <option key={c.id} value={c.id}>{c.case_ref} — {c.family_name} family</option>)}</select></FormRow>
      <FormRow label="Session type"><select className="field" value={f.session_type} onChange={e => setF(p => ({...p, session_type: e.target.value}))}><option value="supervised">Supervised</option><option value="supported">Supported</option><option value="handover">Handover</option></select></FormRow>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        <FormRow label="Date"><input type="date" className="field" value={f.date} onChange={e => setF(p => ({...p, date: e.target.value}))} /></FormRow>
        <FormRow label="Start"><input type="time" className="field" value={f.start_time} onChange={e => setF(p => ({...p, start_time: e.target.value}))} /></FormRow>
        <FormRow label="End"><input type="time" className="field" value={f.end_time} onChange={e => setF(p => ({...p, end_time: e.target.value}))} /></FormRow>
      </div>
      <FormRow label="Supervisor"><select className="field" value={f.supervisor} onChange={e => setF(p => ({...p, supervisor: e.target.value}))}><option>Sarah Chen</option><option>James Okafor</option><option>Maria Torres</option></select></FormRow>
      <FormRow label="Room"><select className="field" value={f.room} onChange={e => setF(p => ({...p, room: e.target.value}))}><option>Room A</option><option>Room B</option><option>Room C</option><option>Reception</option></select></FormRow>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 12, borderTop: '1px solid var(--border)' }}>
        <button className="btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={submit}>{Icon.plus} Schedule</button>
      </div>
    </Modal>
  );
}

function AddNoteModal({ caseId, sessionId, onClose, onAdd }: { caseId: string; sessionId?: string; onClose: () => void; onAdd: () => void }) {
  const [f, setF] = useState({ note_type: 'observation', body: '', visible_externally: true });
  function submit() {
    if (!f.body.trim()) return;
    store.addNote(caseId, sessionId, { ...f, note_type: f.note_type as any, author: 'Sarah Chen' });
    onAdd(); onClose();
  }
  return (
    <Modal title="Add note" subtitle="Timestamped and immutable once saved." onClose={onClose}>
      <FormRow label="Note type"><select className="field" value={f.note_type} onChange={e => setF(p => ({...p, note_type: e.target.value}))}><option value="observation">Observation</option><option value="welfare_concern">Welfare concern</option><option value="incident">Incident report</option><option value="recommendation">Recommendation</option></select></FormRow>
      <FormRow label="Note"><textarea className="field" style={{ minHeight: 120 }} value={f.body} onChange={e => setF(p => ({...p, body: e.target.value}))} placeholder="Enter your note..." /></FormRow>
      <FormRow label="Visibility"><select className="field" value={f.visible_externally ? 'ext' : 'int'} onChange={e => setF(p => ({...p, visible_externally: e.target.value === 'ext'}))}><option value="ext">Can be shared externally</option><option value="int">Internal only</option></select></FormRow>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 12, borderTop: '1px solid var(--border)' }}>
        <button className="btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={submit}>Save note</button>
      </div>
    </Modal>
  );
}

function IncidentModal({ caseId, sessionId, onClose, onAdd }: { caseId: string; sessionId: string; onClose: () => void; onAdd: () => void }) {
  const [type, setType] = useState('Child welfare concern');
  const [body, setBody] = useState('');
  const [sent, setSent] = useState(false);
  function submit() {
    if (!body.trim()) return;
    store.addNote(caseId, sessionId, { note_type: 'incident', body: `[${type}] ${body}`, author: 'Sarah Chen', visible_externally: true });
    setSent(true); onAdd(); setTimeout(onClose, 1600);
  }
  return (
    <Modal title="⚠ Raise incident" subtitle="This will notify your centre manager immediately." onClose={onClose}>
      {sent ? <div style={{ textAlign: 'center', padding: '28px 0', color: '#10B981', fontSize: 14 }}>✓ Manager notified. Incident logged.</div> : <>
        <FormRow label="Incident type"><select className="field" value={type} onChange={e => setType(e.target.value)}><option>Child welfare concern</option><option>Parent behaviour — verbal</option><option>Parent behaviour — physical</option><option>Medical emergency</option><option>Safeguarding referral required</option></select></FormRow>
        <FormRow label="What is happening"><textarea className="field" style={{ minHeight: 100 }} value={body} onChange={e => setBody(e.target.value)} placeholder="Describe the incident..." /></FormRow>
        <div style={{ background: '#EF444410', border: '1px solid #EF444430', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: '#F87171', marginBottom: 14 }}>This note will be flagged as an incident and is immutable after saving.</div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 12, borderTop: '1px solid var(--border)' }}>
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-danger" onClick={submit}>Notify manager now</button>
        </div>
      </>}
    </Modal>
  );
}

function Dashboard({ onNavigateCase, onOpenNewSession, refresh }: { onNavigateCase: (id: string) => void; onOpenNewSession: () => void; refresh: number }) {
  const todaySessions = store.getTodaySessions();
  const all = store.getCases();
  const allSessions = store.getSessions();
  const live = allSessions.filter(s => s.status === 'in_progress').length;
  const revenue = store.getRevenueStats();
  const openIncidents = store.getOpenIncidents();
  const overdueInvoices = store.getOverdueInvoices();
  const pendingApprovals = store.getPendingApprovals();
  return (
    <div className="fade-in">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 20 }}>
        <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px' }}>
          <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 6 }}>Active cases</div>
          <div style={{ fontSize: 28, fontWeight: 600, color: 'var(--text)', lineHeight: 1 }}>{all.filter(c => c.status === 'active').length}</div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>{all.filter(c=>c.status==='intake').length} in intake</div>
        </div>
        <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px' }}>
          <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 6 }}>Sessions today</div>
          <div style={{ fontSize: 28, fontWeight: 600, color: '#3B82F6', lineHeight: 1 }}>{todaySessions.length}</div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>{live} live now</div>
        </div>
        <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px' }}>
          <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 6 }}>Revenue collected</div>
          <div style={{ fontSize: 24, fontWeight: 600, color: '#10B981', lineHeight: 1, fontFamily: 'DM Mono, monospace' }}>£{revenue.paid.toLocaleString()}</div>
          <div style={{ fontSize: 11, color: revenue.overdue > 0 ? '#F87171' : 'var(--text3)', marginTop: 4 }}>{revenue.overdue > 0 ? `£${revenue.overdue.toLocaleString()} overdue` : `£${revenue.outstanding.toLocaleString()} outstanding`}</div>
        </div>
        <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px' }}>
          <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 6 }}>Open incidents</div>
          <div style={{ fontSize: 28, fontWeight: 600, color: openIncidents.length > 0 ? '#EF4444' : 'var(--text)', lineHeight: 1 }}>{openIncidents.length}</div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>{pendingApprovals.length} share approvals pending</div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div className="section-label" style={{ marginBottom: 0 }}>Today&apos;s sessions</div>
            <button className="btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={onOpenNewSession}>+ Schedule</button>
          </div>
          {todaySessions.length === 0 && <p style={{ fontSize: 13, color: 'var(--text3)' }}>No sessions scheduled today.</p>}
          {todaySessions.map(s => (
            <div key={s.id} onClick={() => onNavigateCase(s.case_id)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}>
              <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, color: 'var(--text3)', minWidth: 44 }}>{formatTime(s.scheduled_start)}</div>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.status==='in_progress'?'#10B981':s.status==='completed'?'#3B82F6':'#50617A', flexShrink: 0 }}></div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{s.family_name} family</div>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>{sessionTypeLabel[s.session_type]} · {s.room}</div>
              </div>
              {s.status==='in_progress' && <div style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, fontWeight:600, color:'#F87171', padding:'2px 8px', borderRadius:20, background:'#EF444415', border:'1px solid #EF444430' }}>● Live</div>}
              {s.status!=='in_progress' && <Badge cls={sessionStatusBadge(s.status)} label={sessionStatusLabel[s.status]} />}
            </div>
          ))}
        </div>
        <div className="card">
          <div className="section-label">Alerts requiring action</div>
          {openIncidents.map(inc => (
            <div key={inc.id} onClick={() => onNavigateCase(inc.case_id)} style={{ display:'flex', gap:10, padding:'10px 12px', borderRadius:8, marginBottom:8, background:'#EF444408', border:'1px solid #EF444425', cursor:'pointer' }}>
              <div style={{ width:6, height:6, borderRadius:'50%', background:'#F87171', marginTop:4, flexShrink:0 }}></div>
              <div><div style={{ fontSize:12, fontWeight:600, color:'var(--text)', marginBottom:2 }}>⚠ Safeguarding — {inc.family_name} family</div><div style={{ fontSize:12, color:'var(--text2)' }}>{inc.category.replace('_',' ')} · {formatDate(inc.reported_at)}</div></div>
            </div>
          ))}
          {overdueInvoices.map(inv => (
            <div key={inv.id} style={{ display:'flex', gap:10, padding:'10px 12px', borderRadius:8, marginBottom:8, background:'#EF444408', border:'1px solid #EF444425' }}>
              <div style={{ width:6, height:6, borderRadius:'50%', background:'#F87171', marginTop:4, flexShrink:0 }}></div>
              <div><div style={{ fontSize:12, fontWeight:600, color:'var(--text)', marginBottom:2 }}>Overdue invoice — {inv.family_name} family</div><div style={{ fontSize:12, color:'var(--text2)' }}>{inv.invoice_number} · £{inv.total} · {inv.client_name}</div></div>
            </div>
          ))}
          {pendingApprovals.map(l => (
            <div key={l.id} style={{ display:'flex', gap:10, padding:'10px 12px', borderRadius:8, marginBottom:8, background:'#F59E0B08', border:'1px solid #F59E0B25' }}>
              <div style={{ width:6, height:6, borderRadius:'50%', background:'#F59E0B', marginTop:4, flexShrink:0 }}></div>
              <div><div style={{ fontSize:12, fontWeight:600, color:'var(--text)', marginBottom:2 }}>Share link pending approval</div><div style={{ fontSize:12, color:'var(--text2)' }}>{l.family_name} family → {l.recipient_name}</div></div>
            </div>
          ))}
          {openIncidents.length===0 && overdueInvoices.length===0 && pendingApprovals.length===0 && (
            <div style={{ padding:'16px 0', textAlign:'center', fontSize:13, color:'var(--text3)' }}>✓ No alerts — all clear</div>
          )}
        </div>
      </div>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}><span className="section-label" style={{ marginBottom: 0 }}>All cases</span></div>
        <table className="data-table">
          <thead><tr><th>Case ref</th><th>Family</th><th>Referral</th><th>Keyworker</th><th>Status</th><th>Sessions</th></tr></thead>
          <tbody>
            {all.map(c => (
              <tr key={c.id} onClick={() => onNavigateCase(c.id)}>
                <td><span style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, color: '#3B82F6' }}>{c.case_ref}</span></td>
                <td>{c.family_name} family</td>
                <td><Badge cls="bg-slate-700/40 text-slate-300 border border-slate-600/30" label={referralLabel[c.referral_source]} /></td>
                <td style={{ color: 'var(--text3)' }}>{c.keyworker}</td>
                <td><Badge cls={caseStatusBadge(c.status)} label={c.status} /></td>
                <td style={{ color: 'var(--text3)' }}>{store.getSessionsByCase(c.id).length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}


function CasesList({ onSelect, refresh }: { onSelect: (id: string) => void; refresh: number }) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const all = store.getCases();
  const filtered = all.filter(c => {
    const q = search.toLowerCase();
    return (!q || c.family_name.toLowerCase().includes(q) || c.case_ref.toLowerCase().includes(q) || c.keyworker.toLowerCase().includes(q)) && (statusFilter === 'all' || c.status === statusFilter);
  });
  return (
    <div className="fade-in">
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <input className="field" style={{ flex: 1 }} placeholder="Search cases, families, references..." value={search} onChange={e => setSearch(e.target.value)} />
        <select className="field" style={{ width: 160 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="all">All statuses</option><option value="intake">Intake</option><option value="active">Active</option><option value="suspended">Suspended</option><option value="closed">Closed</option>
        </select>
      </div>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="data-table">
          <thead><tr><th>Case ref</th><th>Family</th><th>Risk flags</th><th>Referral</th><th>Keyworker</th><th>Status</th><th>Sessions</th></tr></thead>
          <tbody>
            {filtered.map(c => (
              <tr key={c.id} onClick={() => onSelect(c.id)}>
                <td><span style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, color: '#3B82F6' }}>{c.case_ref}</span></td>
                <td>{c.family_name} family</td>
                <td>{c.risk_flags.slice(0, 2).map(f => <Badge key={f} cls="bg-red-900/20 text-red-400 border border-red-800/30" label={riskFlagLabel[f as keyof typeof riskFlagLabel]} />)}{c.risk_flags.length > 2 && <span style={{ fontSize: 11, color: 'var(--text3)' }}> +{c.risk_flags.length - 2}</span>}</td>
                <td><Badge cls="bg-slate-700/40 text-slate-300 border border-slate-600/30" label={referralLabel[c.referral_source]} /></td>
                <td style={{ color: 'var(--text3)' }}>{c.keyworker}</td>
                <td><Badge cls={caseStatusBadge(c.status)} label={c.status} /></td>
                <td style={{ color: 'var(--text3)' }}>{store.getSessionsByCase(c.id).length}</td>
              </tr>
            ))}
            {!filtered.length && <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text3)', padding: '24px' }}>No cases match your search.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CaseDetail({ caseId, onBack, onOpenSession }: { caseId: string; onBack: () => void; onOpenSession: (id: string) => void }) {
  const [tab, setTab] = useState<'overview'|'sessions'|'notes'|'documents'|'sharing'|'billing'|'safeguarding'|'naccc'|'comms'|'feedback'>('overview');
  const [showCompose, setShowCompose] = useState(false);
  const [feedbackSessionId, setFeedbackSessionId] = useState<string|null>(null);
  const [showNote, setShowNote] = useState(false);
  const [showSess, setShowSess] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [docName, setDocName] = useState('');
  const [docType, setDocType] = useState('Court order');
  const [refresh, setRefresh] = useState(0);
  const bump = () => setRefresh(r => r + 1);

  const c = store.getCaseById(caseId);
  if (!c) return null;
  const sessions = store.getSessionsByCase(caseId);
  const notes = store.getAllNotes(caseId);
  const docs = store.getDocumentsByCase(caseId);
  const children = c.persons.filter(p => p.role === 'child');
  const rp = c.persons.find(p => p.role === 'resident_parent');
  const nrp = c.persons.find(p => p.role === 'non_resident_parent');

  return (
    <div className="fade-in">
      {showNote && <AddNoteModal caseId={caseId} onClose={() => setShowNote(false)} onAdd={bump} />}
      {showSess && <NewSessionModal cases={[c]} onClose={() => setShowSess(false)} onCreate={bump} />}
      {showUpload && (
        <Modal title="Upload document" onClose={() => setShowUpload(false)}>
          <FormRow label="Document name"><input className="field" value={docName} onChange={e => setDocName(e.target.value)} placeholder="e.g. Court Order July 2026.pdf" /></FormRow>
          <FormRow label="Type"><select className="field" value={docType} onChange={e => setDocType(e.target.value)}><option>Court order</option><option>Risk assessment</option><option>Cafcass report</option><option>Correspondence</option><option>Other</option></select></FormRow>
          <div style={{ border: '2px dashed var(--border2)', borderRadius: 8, padding: '24px', textAlign: 'center', color: 'var(--text3)', fontSize: 13, marginBottom: 14 }}>{Icon.upload} <span style={{ marginLeft: 6 }}>Drop file here or click to browse</span></div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 12, borderTop: '1px solid var(--border)' }}>
            <button className="btn-ghost" onClick={() => setShowUpload(false)}>Cancel</button>
            <button className="btn-primary" onClick={() => { store.addDocument({ case_id: caseId, name: docName || 'Document.pdf', type: docType, size: '1.0 MB' }); bump(); setShowUpload(false); setDocName(''); }}>Upload</button>
          </div>
        </Modal>
      )}
      <button className="btn-ghost" style={{ marginBottom: 14, fontSize: 12 }} onClick={onBack}>{Icon.back} Back to cases</button>
      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#3B82F6', marginBottom: 4 }}>{c.case_ref}</div>
        <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--text)', marginBottom: 10 }}>{c.family_name} family</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          <Badge cls={caseStatusBadge(c.status)} label={c.status} />
          {c.risk_flags.map(f => <Badge key={f} cls="bg-red-900/20 text-red-400 border border-red-800/30" label={riskFlagLabel[f as keyof typeof riskFlagLabel]} />)}
          <span style={{ fontSize: 12, color: 'var(--text3)', alignSelf: 'center', marginLeft: 4 }}>Keyworker: {c.keyworker} · {c.centre}</span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 2, borderBottom: '1px solid var(--border)', marginBottom: 16 }}>
        {(['overview','sessions','notes','documents','comms','sharing','billing','safeguarding','naccc'] as const).map(t => {
        const labels: Record<string,string> = {
          overview:'Overview', sessions:`Sessions (${sessions.length})`, notes:`Notes (${notes.length})`,
          documents:`Documents (${docs.length})`, comms:`Comms (${storeExt.getCommLogs(caseId).length})`,
          sharing:`Sharing (${store.getShareLinksByCase(caseId).length})`,
          billing:`Billing (${store.getInvoicesByCase(caseId).length})`,
          safeguarding:`Safeguarding (${store.getSafeguardingByCase(caseId).length})`,
          naccc:`NACCC (${store.getNACCCReportsByCase(caseId).length})`,
        };
        return (
          <button key={t} onClick={() => setTab(t)} style={{ padding: '8px 12px', fontSize: 12, fontWeight: 500, border: 'none', background: 'none', color: tab === t ? '#3B82F6' : 'var(--text3)', borderBottom: `2px solid ${tab === t ? '#3B82F6' : 'transparent'}`, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', marginBottom: -1, whiteSpace: 'nowrap' }}>
            {labels[t]}
          </button>
        );
      })}
      </div>

      {tab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="card-sm">
            <div className="section-label">Children</div>
            {children.map(p => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#1D4ED820', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: '#60A5FA', flexShrink: 0 }}>{p.name.split(' ').map(n => n[0]).join('')}</div>
                <div><div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{p.name}</div><div style={{ fontSize: 11, color: 'var(--text3)' }}>{p.dob ? `Age ${ageFromDob(p.dob)} · DOB ${formatDate(p.dob)}` : 'No DOB recorded'}</div></div>
              </div>
            ))}
          </div>
          <div className="card-sm">
            <div className="section-label">Parties</div>
            {rp && <div style={{ marginBottom: 10 }}><div style={{ fontSize: 11, color: 'var(--text3)' }}>Resident parent</div><div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{rp.name}</div></div>}
            {nrp && <div style={{ marginBottom: 10 }}><div style={{ fontSize: 11, color: 'var(--text3)' }}>Non-resident parent</div><div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{nrp.name}</div></div>}
            {c.social_worker && <div style={{ marginBottom: 10 }}><div style={{ fontSize: 11, color: 'var(--text3)' }}>Social worker</div><div style={{ fontSize: 13, color: 'var(--text)' }}>{c.social_worker}</div></div>}
            {c.cafcass_officer && <div><div style={{ fontSize: 11, color: 'var(--text3)' }}>Cafcass officer</div><div style={{ fontSize: 13, color: 'var(--text)' }}>{c.cafcass_officer}</div></div>}
          </div>
          <div className="card-sm" style={{ gridColumn: '1 / -1' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
              <div><div style={{ fontSize: 11, color: 'var(--text3)' }}>Referral source</div><div style={{ fontSize: 13, color: 'var(--text)', marginTop: 2 }}>{referralLabel[c.referral_source]}</div></div>
              <div><div style={{ fontSize: 11, color: 'var(--text3)' }}>Court order ref</div><div style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, color: '#3B82F6', marginTop: 2 }}>{c.legal_order_ref || '—'}</div></div>
              <div><div style={{ fontSize: 11, color: 'var(--text3)' }}>Case opened</div><div style={{ fontSize: 13, color: 'var(--text)', marginTop: 2 }}>{formatDate(c.created_at)}</div></div>
            </div>
          </div>
          <div className="card-sm" style={{ gridColumn: '1 / -1' }}>
            <ContactNumberManager caseId={caseId} />
          </div>
        </div>
      )}

      {tab === 'sessions' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            <button className="btn-primary" onClick={() => setShowSess(true)}>{Icon.plus} Schedule session</button>
          </div>
          {sessions.length === 0 && <p style={{ fontSize: 13, color: 'var(--text3)' }}>No sessions yet.</p>}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="data-table">
              <thead><tr><th>Date & time</th><th>Type</th><th>Supervisor</th><th>Room</th><th>Attendees</th><th>Status</th><th>Notes</th></tr></thead>
              <tbody>
                {sessions.map(s => (
                  <tr key={s.id} onClick={() => onOpenSession(s.id)}>
                    <td><span style={{ fontFamily: 'DM Mono, monospace', fontSize: 12 }}>{formatDateTime(s.scheduled_start)}</span></td>
                    <td><Badge cls={sessionTypeBadge(s.session_type)} label={sessionTypeLabel[s.session_type]} /></td>
                    <td style={{ color: 'var(--text3)' }}>{s.supervisor}</td>
                    <td style={{ color: 'var(--text3)' }}>{s.room}</td>
                    <td style={{ color: 'var(--text3)' }}>{s.attendees.length || '—'}</td>
                    <td><Badge cls={sessionStatusBadge(s.status)} label={sessionStatusLabel[s.status]} /></td>
                    <td style={{ color: 'var(--text3)' }}>{s.notes.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'notes' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            <button className="btn-primary" onClick={() => setShowNote(true)}>{Icon.plus} Add note</button>
          </div>
          {notes.length === 0 && <p style={{ fontSize: 13, color: 'var(--text3)' }}>No notes yet.</p>}
          {notes.map(n => (
            <div key={n.id} className="card-sm" style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Badge cls={noteTypeBadge(n.note_type)} label={noteTypeLabel[n.note_type]} />
                <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text2)' }}>{n.author}</span>
                <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'DM Mono, monospace' }}>{formatDateTime(n.created_at)}</span>
                {!n.visible_externally && <Badge cls="bg-slate-700/40 text-slate-400 border border-slate-600/30" label="Internal only" />}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.7 }}>{n.body}</div>
            </div>
          ))}
        </div>
      )}

      {tab === 'documents' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            <button className="btn-primary" onClick={() => setShowUpload(true)}>{Icon.upload} Upload document</button>
          </div>
          {docs.length === 0 && <p style={{ fontSize: 13, color: 'var(--text3)' }}>No documents uploaded yet.</p>}
          {docs.map(d => (
            <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: 'var(--surface2)', borderRadius: 8, marginBottom: 8, border: '1px solid var(--border)' }}>
              <div style={{ width: 34, height: 34, borderRadius: 8, background: '#1D4ED815', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#60A5FA', flexShrink: 0 }}>{Icon.doc}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{d.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>{d.type} · {d.size} · {d.uploaded_by} · {formatDate(d.uploaded_at)}</div>
              </div>
              <button className="btn-ghost" style={{ padding: '5px 10px', fontSize: 12 }}>View</button>
            </div>
          ))}
        </div>
      )}

      {tab === 'sharing' && <SharingPage caseId={caseId} onBack={() => {}} />}
      {tab === 'billing' && <BillingPage caseId={caseId} />}
      {tab === 'safeguarding' && <SafeguardingPage caseId={caseId} />}
      {tab === 'naccc' && <NACCCPage caseId={caseId} />}
      {showCompose && <ComposeEmailModal caseId={caseId} onClose={() => setShowCompose(false)} onSent={bump} />}
      {tab === 'comms' && (
        <div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginBottom: 12 }}>
            <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => setShowCompose(true)}>📤 Send email</button>
          </div>
          <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', marginBottom: 14 }}>
            {(['all', 'phone', 'email', 'other'] as const).map(f => (
              <button key={f} onClick={() => (window as any).__commFilter = f}
                style={{ padding: '6px 14px', fontSize: 12, border: 'none', background: 'none', color: 'var(--text3)', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', textTransform: 'capitalize' }}>
                {f === 'all' ? 'All' : f === 'phone' ? '📞 Calls' : f === 'email' ? '📧 Emails' : '💬 Other'}
              </button>
            ))}
          </div>
          <CaseCallLog caseId={caseId} />
          <CommLogPage caseId={caseId} />
        </div>
      )}
      {tab === 'feedback' && feedbackSessionId && (
        <SessionFeedbackForm
          sessionId={feedbackSessionId} caseId={caseId}
          onClose={() => { setFeedbackSessionId(null); setTab('sessions'); }}
          onSaved={() => setTab('sessions')}
        />
      )}
    </div>
  );
}

function LiveSession({ sessionId, onBack }: { sessionId: string; onBack: () => void }) {
  const [tick, setTick] = useState(0);
  const [showNote, setShowNote] = useState(false);
  const [showIncident, setShowIncident] = useState(false);
  const [obsInput, setObsInput] = useState('');
  const [refresh, setRefresh] = useState(0);
  const bump = () => setRefresh(r => r + 1);

  useEffect(() => { const id = setInterval(() => setTick(t => t + 1), 1000); return () => clearInterval(id); }, []);

  const s = store.getSessions().find(x => x.id === sessionId);
  if (!s) return <div style={{ color: 'var(--text3)', padding: 20 }}>Session not found.</div>;
  const caseId = s.case_id;

  const elapsed = s.actual_start ? Math.floor((Date.now() - new Date(s.actual_start).getTime()) / 1000) : 0;
  const mm = String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0');
  const ss2 = String(elapsed % 60).padStart(2, '0');
  const hh = Math.floor(elapsed / 3600);
  const timer = `${hh ? hh + ':' : ''}${mm}:${ss2}`;

  const c = store.getCaseById(s.case_id);
  const contactPersons = (c?.persons || []).filter(p => p.role !== 'resident_parent');

  function addObs() {
    if (!obsInput.trim()) return;
    store.addNote(caseId, sessionId, { note_type: 'observation', body: obsInput.trim(), author: 'Sarah Chen', visible_externally: true });
    setObsInput(''); bump();
  }

  const current = store.getSessions().find(x => x.id === sessionId)!;

  return (
    <div className="fade-in">
      {showNote && <AddNoteModal caseId={s.case_id} sessionId={sessionId} onClose={() => setShowNote(false)} onAdd={bump} />}
      {showIncident && <IncidentModal caseId={s.case_id} sessionId={sessionId} onClose={() => setShowIncident(false)} onAdd={bump} />}
      <button className="btn-ghost" style={{ marginBottom: 14, fontSize: 12 }} onClick={onBack}>{Icon.back} Back</button>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, alignItems: 'start' }}>
        <div>
          <div className="card" style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{s.family_name} family</div>
              {s.status === 'in_progress' && <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, color: '#F87171', padding: '2px 8px', borderRadius: 20, background: '#EF444415', border: '1px solid #EF444430' }}><span className="live-dot">{Icon.live}</span> Live</div>}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 2 }}>{s.case_ref} · {sessionTypeLabel[s.session_type]} · {s.room}</div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 12 }}>Supervisor: {s.supervisor}</div>
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 36, fontWeight: 500, color: s.status === 'in_progress' ? '#10B981' : 'var(--text3)', margin: '12px 0' }}>{s.status === 'in_progress' ? timer : formatTime(s.scheduled_start)}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {s.status === 'scheduled' && <button className="btn-primary" style={{ flex: 1 }} onClick={() => { store.updateSessionStatus(sessionId, 'in_progress'); bump(); }}>Start session</button>}
              {s.status === 'in_progress' && <>
                <button className="btn-ghost" style={{ flex: 1 }} onClick={() => setShowNote(true)}>{Icon.plus} Log note</button>
                <button className="btn-primary" style={{ flex: 1 }} onClick={() => { store.updateSessionStatus(sessionId, 'completed'); bump(); onBack(); }}>End session</button>
              </>}
              {s.status === 'completed' && <div style={{ fontSize: 13, color: '#10B981' }}>✓ Session completed</div>}
            </div>
          </div>
          <div className="card-sm" style={{ marginBottom: 12 }}>
            <div className="section-label">Attendee check-in</div>
            {contactPersons.map(p => {
              const checked = current.attendees.includes(p.name);
              return (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ flex: 1, fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{p.name}</div>
                  {checked && <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#10B981' }}>Arrived</span>}
                  <button onClick={() => { if (!checked) { store.checkInAttendee(sessionId, p.name); bump(); } }} style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 500, cursor: checked ? 'default' : 'pointer', border: `1px solid ${checked ? '#10B98140' : 'var(--border)'}`, background: checked ? '#10B98115' : 'var(--surface3)', color: checked ? '#10B981' : 'var(--text2)', fontFamily: 'DM Sans, sans-serif' }}>
                    {checked ? '✓ Checked in' : 'Check in'}
                  </button>
                </div>
              );
            })}
          </div>
          {s.status === 'in_progress' && (
            <button onClick={() => setShowIncident(true)} style={{ width: '100%', padding: 13, borderRadius: 9, background: '#EF444412', border: '1px solid #EF444435', color: '#F87171', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
              ⚠ Raise incident — notify manager immediately
            </button>
          )}
        </div>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', maxHeight: 520 }}>
          <div className="section-label">Observation log</div>
          <div style={{ flex: 1, overflowY: 'auto', marginBottom: 12 }}>
            {current.notes.length === 0 && <p style={{ fontSize: 13, color: 'var(--text3)' }}>No observations logged yet.</p>}
            {current.notes.map(n => (
              <div key={n.id} style={{ padding: '9px 11px', background: 'var(--surface3)', borderRadius: 7, marginBottom: 6 }}>
                <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: n.note_type === 'incident' ? '#F87171' : n.note_type === 'welfare_concern' ? '#FBBF24' : 'var(--text3)', marginBottom: 3 }}>{new Date(n.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} · {noteTypeLabel[n.note_type]}</div>
                <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6 }}>{n.body}</div>
              </div>
            ))}
          </div>
          {s.status === 'in_progress' && (
            <div>
              <textarea className="field" style={{ minHeight: 70, marginBottom: 8 }} value={obsInput} onChange={e => setObsInput(e.target.value)} placeholder="Type observation..." onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) addObs(); }} />
              <button className="btn-primary" style={{ width: '100%' }} onClick={addObs}>{Icon.plus} Add observation</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Reports({ refresh }: { refresh: number }) {
  const all = store.getSessions();
  const cases = store.getCases();
  const completed = all.filter(s => s.status === 'completed').length;
  const byType = (t: string) => all.filter(s => s.session_type === t).length;
  return (
    <div className="fade-in">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 20 }}>
        <Metric label="Total sessions" value={all.length} />
        <Metric label="Completed" value={completed} color="#10B981" />
        <Metric label="Active cases" value={cases.filter(c => c.status === 'active').length} color="#3B82F6" />
        <Metric label="Completion rate" value={all.length ? `${Math.round(completed / all.length * 100)}%` : '—'} color="#8B5CF6" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div className="card">
          <div className="section-label">Sessions by type</div>
          {(['supervised','supported','handover'] as const).map((t, i) => {
            const count = byType(t); const colors = ['#F87171','#3B82F6','#14B8A6'];
            return (
              <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <div style={{ fontSize: 13, color: 'var(--text)', width: 90, textTransform: 'capitalize' }}>{t}</div>
                <div style={{ flex: 1, background: 'var(--surface3)', borderRadius: 4, height: 8, overflow: 'hidden' }}>
                  <div style={{ width: `${all.length ? count / all.length * 100 : 0}%`, background: colors[i], height: '100%', borderRadius: 4 }} />
                </div>
                <div style={{ fontSize: 13, color: 'var(--text2)', width: 24, textAlign: 'right' }}>{count}</div>
              </div>
            );
          })}
        </div>
        <div className="card">
          <div className="section-label">Cases by referral source</div>
          {(['local_authority','private','cafcass','court_ordered'] as const).map(src => (
            <div key={src} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
              <span style={{ color: 'var(--text)' }}>{referralLabel[src]}</span>
              <span style={{ color: 'var(--text2)', fontFamily: 'DM Mono, monospace', fontSize: 12 }}>{cases.filter(c => c.referral_source === src).length}</span>
            </div>
          ))}
        </div>
        <div className="card" style={{ gridColumn: '1 / -1', padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}><span className="section-label" style={{ marginBottom: 0 }}>All sessions</span></div>
          <table className="data-table">
            <thead><tr><th>Date</th><th>Family</th><th>Type</th><th>Supervisor</th><th>Attendees</th><th>Status</th><th>Notes</th></tr></thead>
            <tbody>
              {all.slice(0,10).map(s => (
                <tr key={s.id}>
                  <td><span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11 }}>{formatDateTime(s.scheduled_start)}</span></td>
                  <td>{s.family_name} family</td>
                  <td><Badge cls={sessionTypeBadge(s.session_type)} label={sessionTypeLabel[s.session_type]} /></td>
                  <td style={{ color: 'var(--text3)' }}>{s.supervisor}</td>
                  <td style={{ color: 'var(--text3)' }}>{s.attendees.length || '—'}</td>
                  <td><Badge cls={sessionStatusBadge(s.status)} label={sessionStatusLabel[s.status]} /></td>
                  <td style={{ color: 'var(--text3)' }}>{s.notes.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  type NavPage = 'dashboard'|'cases'|'session'|'sharing'|'billing'|'safeguarding'|'naccc'|'waiting'|'gmail'|'calls'|'rota'|'reports';
  const [page, setPage] = useState<NavPage>('dashboard');
  const [selectedCase, setSelectedCase] = useState<string|null>(null);
  const [selectedSession, setSelectedSession] = useState<string|null>(null);
  const [showNewCase, setShowNewCase] = useState(false);
  const [showNewSession, setShowNewSession] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const bump = useCallback(() => setRefresh(r => r + 1), []);

  const liveSession = store.getSessions().find(s => s.status === 'in_progress');

  function openCase(id: string) { setSelectedCase(id); setPage('cases'); }
  function openSession(id: string) { setSelectedSession(id); setPage('session'); }

  const openIncidents = store.getOpenIncidents().length;
  const pendingApprovals = store.getPendingApprovals().length;
  const overdueInvoices = store.getOverdueInvoices().length;

  const navItems = [
    { key: 'dashboard', label: 'Dashboard', icon: <svg width="15" height="15" viewBox="0 0 15 15" fill="currentColor"><rect x="1" y="1" width="5.5" height="5.5" rx="1"/><rect x="8.5" y="1" width="5.5" height="5.5" rx="1"/><rect x="1" y="8.5" width="5.5" height="5.5" rx="1"/><rect x="8.5" y="8.5" width="5.5" height="5.5" rx="1"/></svg> },
    { key: 'cases', label: 'Cases', icon: <svg width="15" height="15" viewBox="0 0 15 15" fill="currentColor"><path d="M1 3a1 1 0 011-1h4.586a1 1 0 01.707.293L8.707 3.707A1 1 0 009.414 4H13a1 1 0 011 1v7a1 1 0 01-1 1H2a1 1 0 01-1-1V3z"/></svg> },
    { key: 'session', label: 'Live session', icon: <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4"><circle cx="7.5" cy="7.5" r="6"/><path d="M7.5 4.5v3.5l2.5 1.5" strokeLinecap="round"/></svg>, badge: liveSession ? '1' : undefined, badgeColor: '#EF4444' },
    { key: 'sharing', label: 'Secure sharing', icon: <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4"><circle cx="11" cy="2.5" r="1.5"/><circle cx="4" cy="7.5" r="1.5"/><circle cx="11" cy="12.5" r="1.5"/><path d="M5.5 6.5l4-3M5.5 8.5l4 3" strokeLinecap="round"/></svg>, badge: pendingApprovals > 0 ? String(pendingApprovals) : undefined, badgeColor: '#F59E0B' },
    { key: 'billing', label: 'Billing', icon: <svg width="15" height="15" viewBox="0 0 15 15" fill="currentColor"><path d="M2 2h11v11H2V2zm1 3v7h9V5H3zm1 1h7v1H4V6zm0 2.5h7v1H4v-1zm0 2.5h4v1H4V11z"/></svg>, badge: overdueInvoices > 0 ? String(overdueInvoices) : undefined, badgeColor: '#EF4444' },
    { key: 'safeguarding', label: 'Safeguarding', icon: <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M7.5 1.5l5 2v4c0 3.5-2.5 6-5 6.5C5 13.5 2.5 11 2.5 7.5v-4l5-2z"/></svg>, badge: openIncidents > 0 ? String(openIncidents) : undefined, badgeColor: '#EF4444' },
    { key: 'naccc', label: 'NACCC Reports', icon: <svg width="15" height="15" viewBox="0 0 15 15" fill="currentColor"><path d="M2 1a1 1 0 011-1h6.586a1 1 0 01.707.293L13.707 3.707A1 1 0 0114 4.414V14a1 1 0 01-1 1H3a1 1 0 01-1-1V1zm2 4h7v1H4V5zm0 2.5h7v1H4v-1zm0 2.5h5v1H4V10z"/></svg> },
    { key: 'waiting', label: 'Waiting list', icon: <svg width="15" height="15" viewBox="0 0 15 15" fill="currentColor"><path d="M7.5 1a6.5 6.5 0 100 13A6.5 6.5 0 007.5 1zm0 1.5a5 5 0 110 10 5 5 0 010-10zm-.75 2v5h4v-1.5H8.25V4.5H6.75z"/></svg>, badge: (() => { const w = storeExt.getWaitingList().filter((e: {status: string}) => e.status === 'waiting').length; return w > 0 ? String(w) : undefined; })(), badgeColor: '#F59E0B' },
    { key: 'gmail', label: 'Gmail', icon: <svg width="15" height="15" viewBox="0 0 15 15" fill="currentColor"><path d="M1 3a1 1 0 011-1h11a1 1 0 011 1v9a1 1 0 01-1 1H2a1 1 0 01-1-1V3zm1 0v.5l5.5 4 5.5-4V3H2zm11 1.5l-5.5 4-5.5-4V12h11V4.5z"/></svg> },
    { key: 'calls', label: 'Phone calls', icon: <svg width="15" height="15" viewBox="0 0 15 15" fill="currentColor"><path d="M3.5 1A1.5 1.5 0 002 2.5v.5C2 9.404 5.596 13 10.5 13h.5a1.5 1.5 0 001.5-1.5v-1.879a1.5 1.5 0 00-.44-1.06l-1.242-1.243a1.5 1.5 0 00-1.945-.155L8.5 7.95A5.522 5.522 0 016.05 5.5l.787-.873a1.5 1.5 0 00-.155-1.945L5.439 1.439A1.5 1.5 0 004.379 1H3.5z"/></svg>, badge: (() => { const m = storeExt.getAllCommLogs().filter((c: any) => c.channel === 'phone' && c.subject?.includes('Missed') && c.action_required).length; return m > 0 ? String(m) : undefined; })(), badgeColor: '#EF4444' },
    { key: 'rota', label: 'Rota', icon: <svg width="15" height="15" viewBox="0 0 15 15" fill="currentColor"><rect x="1" y="2" width="13" height="12" rx="1" fill="none" stroke="currentColor" strokeWidth="1.2"/><path d="M1 5h13M5 2v3M10 2v3M4 8h2v2H4zM7 8h2v2H7zM10 8h2v2h-2z" stroke="currentColor" strokeWidth="1.2" fill="none"/></svg> },
    { key: 'reports', label: 'Reports', icon: <svg width="15" height="15" viewBox="0 0 15 15" fill="currentColor"><path d="M1 1h2v13H1V1zm4 4h2v9H5V5zm4-3h2v12H9V2zm4 5h2v7h-2V7z"/></svg> },
  ] as const;

  const pageTitle = selectedCase && page === 'cases'
    ? `${store.getCaseById(selectedCase)?.family_name || ''} family`
    : { dashboard: 'Dashboard', cases: 'Cases', session: 'Sessions', sharing: 'Secure Sharing', billing: 'Billing & Invoicing', safeguarding: 'Safeguarding', naccc: 'NACCC Reports', waiting: 'Waiting List', gmail: 'Gmail Integration', calls: 'Phone Calls', rota: 'Rota & Scheduling', reports: 'Reports' }[page];

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {showNewCase && <NewCaseModal onClose={() => setShowNewCase(false)} onCreate={(c) => { openCase(c.id); bump(); }} />}
      {showNewSession && <NewSessionModal cases={store.getCases()} onClose={() => setShowNewSession(false)} onCreate={bump} />}

      {/* Sidebar */}
      <div style={{ width: 220, background: 'var(--surface)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '20px 16px 16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <div style={{ width: 30, height: 30, background: '#2563EB', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="white"><path d="M7 1a4.5 4.5 0 100 9A4.5 4.5 0 007 1zm0 2a2.5 2.5 0 110 5A2.5 2.5 0 017 3z"/><circle cx="7" cy="12.5" r="1.5"/></svg>
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>SafeSpace</div>
              <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'DM Mono, monospace' }}>Contact Centre OS</div>
            </div>
          </div>
        </div>
        <nav style={{ padding: '10px 8px', flex: 1 }}>
          {navItems.map(item => (
            <button key={item.key} onClick={() => { setPage(item.key as NavPage); if (item.key === 'session' && liveSession) setSelectedSession(liveSession.id); if (item.key !== 'cases') setSelectedCase(null); }} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, cursor: 'pointer', color: page === item.key ? 'var(--text)' : 'var(--text2)', background: page === item.key ? 'var(--surface3)' : 'transparent', borderLeft: `2px solid ${page === item.key ? '#3B82F6' : 'transparent'}`, border: `none`, outline: 'none', width: '100%', marginBottom: 2, fontSize: 13, fontFamily: 'DM Sans, sans-serif', fontWeight: 500, textAlign: 'left', transition: 'all 0.12s', boxShadow: 'none' }}>
              <span style={{ opacity: page === item.key ? 1 : 0.6 }}>{item.icon}</span>
              <span style={{ flex: 1 }}>{item.label}</span>
              {'badge' in item && item.badge && <span style={{ background: 'badgeColor' in item ? (item as any).badgeColor : '#EF4444', color: 'white', fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 10 }}>{item.badge}</span>}
            </button>
          ))}
        </nav>
        <div style={{ padding: 12, borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 9, background: 'var(--surface2)', borderRadius: 8, marginBottom: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#7C3AED30', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: '#A78BFA' }}>SC</div>
            <div><div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)' }}>Sarah Chen</div><div style={{ fontSize: 10, color: 'var(--text3)' }}>Centre Manager</div></div>
          </div>
          <a href="/admin" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', borderRadius: 6, fontSize: 11, color: '#8B5CF6', textDecoration: 'none', background: '#8B5CF610', border: '1px solid #8B5CF630' }}>
            <span>🔐</span> Super admin
          </a>
        </div>
      </div>

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ height: 54, borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', padding: '0 20px', gap: 12, background: 'var(--surface)', flexShrink: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{pageTitle}</div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'DM Mono, monospace' }}>BST · Basingstoke</div>
            {(page === 'dashboard' || (page === 'cases' && !selectedCase)) && <button className="btn-primary" onClick={() => setShowNewCase(true)}>{Icon.plus} New case</button>}
          </div>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
          {page === 'dashboard' && <Dashboard key={refresh} onNavigateCase={openCase} onOpenNewSession={() => setShowNewSession(true)} refresh={refresh} />}
          {page === 'cases' && !selectedCase && <CasesList key={refresh} onSelect={setSelectedCase} refresh={refresh} />}
          {page === 'cases' && selectedCase && <CaseDetail key={selectedCase + refresh} caseId={selectedCase} onBack={() => setSelectedCase(null)} onOpenSession={openSession} />}
          {page === 'session' && selectedSession && <LiveSession key={selectedSession + refresh} sessionId={selectedSession} onBack={() => { setPage('dashboard'); setSelectedSession(null); }} />}
          {page === 'session' && !selectedSession && (
            <div>
              <div className="section-label" style={{ marginBottom: 14 }}>Select a session to manage</div>
              {store.getTodaySessions().map(s => (
                <div key={s.id} onClick={() => setSelectedSession(s.id)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, marginBottom: 8, cursor: 'pointer' }}>
                  <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 13, color: 'var(--text3)', minWidth: 50 }}>{formatTime(s.scheduled_start)}</div>
                  <div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>{s.family_name} family</div><div style={{ fontSize: 12, color: 'var(--text3)' }}>{s.case_ref} · {sessionTypeLabel[s.session_type]} · {s.room}</div></div>
                  <Badge cls={sessionStatusBadge(s.status)} label={sessionStatusLabel[s.status]} />
                </div>
              ))}
            </div>
          )}
          {page === 'reports' && <Reports key={refresh} refresh={refresh} />}
          {page === 'sharing' && <SharingPage key={refresh} />}
          {page === 'billing' && <BillingPage key={refresh} />}
          {page === 'safeguarding' && <SafeguardingPage key={refresh} />}
          {page === 'naccc' && <NACCCPage key={refresh} />}
          {page === 'waiting' && <WaitingListPage key={refresh} />}
          {page === 'gmail' && <GmailPage key={refresh} />}
          {page === 'rota' && <RotaPage key={refresh} />}
          {page === 'calls' && <CallsPage key={refresh} />}
        </div>
      </div>
    </div>
  );
}

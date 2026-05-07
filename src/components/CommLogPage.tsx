'use client';
import { useState } from 'react';
import { storeExt as store, CommunicationLog, CommChannel, CommDirection, CommParty } from '@/lib/store';
import { formatDateTime } from '@/lib/ui';

const channelIcon: Record<CommChannel, string> = { phone: '📞', email: '📧', letter: '✉️', in_person: '🤝', other: '💬' };
const channelLabel: Record<CommChannel, string> = { phone: 'Phone', email: 'Email', letter: 'Letter', in_person: 'In person', other: 'Other' };
const partyLabel: Record<CommParty, string> = { resident_parent: 'Resident parent', non_resident_parent: 'Non-resident parent', social_worker: 'Social worker', cafcass: 'Cafcass', solicitor: 'Solicitor', court: 'Court', other: 'Other' };

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box fade-in" style={{ maxWidth: 520 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>{title}</h2>
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

function AddCommModal({ caseId, onClose, onAdd }: { caseId: string; onClose: () => void; onAdd: () => void }) {
  const today = new Date().toISOString().slice(0, 16);
  const [form, setForm] = useState({ direction: 'outbound' as CommDirection, channel: 'phone' as CommChannel, party: 'social_worker' as CommParty, party_name: '', subject: '', summary: '', action_required: '', communicated_at: today });

  function submit() {
    if (!form.summary.trim() || !form.party_name.trim()) return;
    store.addCommLog({ ...form, case_id: caseId, logged_by: 'Sarah Chen' });
    onAdd(); onClose();
  }

  return (
    <Modal title="Log communication" onClose={onClose}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <FormRow label="Direction">
          <select className="field" value={form.direction} onChange={e => setForm(p => ({ ...p, direction: e.target.value as CommDirection }))}>
            <option value="inbound">Inbound (received)</option>
            <option value="outbound">Outbound (sent)</option>
          </select>
        </FormRow>
        <FormRow label="Channel">
          <select className="field" value={form.channel} onChange={e => setForm(p => ({ ...p, channel: e.target.value as CommChannel }))}>
            {(Object.keys(channelLabel) as CommChannel[]).map(c => <option key={c} value={c}>{channelLabel[c]}</option>)}
          </select>
        </FormRow>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <FormRow label="Party type">
          <select className="field" value={form.party} onChange={e => setForm(p => ({ ...p, party: e.target.value as CommParty }))}>
            {(Object.keys(partyLabel) as CommParty[]).map(p => <option key={p} value={p}>{partyLabel[p]}</option>)}
          </select>
        </FormRow>
        <FormRow label="Party name"><input className="field" value={form.party_name} onChange={e => setForm(p => ({ ...p, party_name: e.target.value }))} placeholder="e.g. K. Bridges" /></FormRow>
      </div>
      <FormRow label="Date & time"><input type="datetime-local" className="field" value={form.communicated_at} onChange={e => setForm(p => ({ ...p, communicated_at: e.target.value }))} /></FormRow>
      <FormRow label="Subject (optional)"><input className="field" value={form.subject} onChange={e => setForm(p => ({ ...p, subject: e.target.value }))} placeholder="Brief subject or topic" /></FormRow>
      <FormRow label="Summary">
        <textarea className="field" style={{ minHeight: 90 }} value={form.summary} onChange={e => setForm(p => ({ ...p, summary: e.target.value }))} placeholder="What was discussed / communicated?" />
      </FormRow>
      <FormRow label="Action required (optional)">
        <input className="field" value={form.action_required} onChange={e => setForm(p => ({ ...p, action_required: e.target.value }))} placeholder="e.g. Send written update by Friday" />
      </FormRow>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 12, borderTop: '1px solid var(--border)' }}>
        <button className="btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={submit} style={{ opacity: form.summary.trim() && form.party_name.trim() ? 1 : 0.4 }}>Log communication</button>
      </div>
    </Modal>
  );
}

export default function CommLogPage({ caseId }: { caseId?: string }) {
  const [showAdd, setShowAdd] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const bump = () => setRefresh(r => r + 1);

  const logs = caseId ? store.getCommLogs(caseId) : store.getAllCommLogs();

  return (
    <div className="fade-in">
      {showAdd && caseId && <AddCommModal caseId={caseId} onClose={() => setShowAdd(false)} onAdd={bump} />}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        {caseId && <button className="btn-primary" style={{ fontSize: 12 }} onClick={() => setShowAdd(true)}>+ Log communication</button>}
      </div>

      {logs.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text3)', fontSize: 13 }}>No communications logged yet.</div>
      )}

      {logs.map(log => (
        <div key={log.id} style={{ display: 'flex', gap: 14, padding: '14px 0', borderBottom: '1px solid var(--border)' }}>
          {/* Direction indicator */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 40 }}>
            <div style={{ fontSize: 20 }}>{channelIcon[log.channel]}</div>
            <div style={{ fontSize: 10, color: log.direction === 'inbound' ? '#10B981' : '#3B82F6', fontWeight: 600 }}>
              {log.direction === 'inbound' ? '↓ IN' : '↑ OUT'}
            </div>
          </div>

          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{partyLabel[log.party]}: {log.party_name}</span>
              <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'DM Mono, monospace' }}>{formatDateTime(log.communicated_at)}</span>
              <span style={{ fontSize: 11, color: 'var(--text3)' }}>· Logged by {log.logged_by}</span>
            </div>
            {log.subject && <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text2)', marginBottom: 4 }}>{log.subject}</div>}
            <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6, marginBottom: log.action_required ? 8 : 0 }}>{log.summary}</div>
            {log.action_required && (
              <div style={{ fontSize: 12, background: '#F59E0B10', border: '1px solid #F59E0B30', borderRadius: 6, padding: '6px 10px', color: '#FBBF24', display: 'inline-block' }}>
                → Action: {log.action_required}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

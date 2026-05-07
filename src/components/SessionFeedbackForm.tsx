'use client';
import { useState } from 'react';
import { storeExt as store, SessionFeedback } from '@/lib/store';
import { sessionTypeLabel, formatDate, formatTime } from '@/lib/ui';

function StarRating({ value, onChange, label }: { value?: number; onChange: (v: number) => void; label: string }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label className="field-label">{label}</label>
      <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
        {[1,2,3,4,5].map(n => (
          <button key={n} onClick={() => onChange(n)}
            style={{ width: 36, height: 36, borderRadius: 7, border: `1px solid ${value && value >= n ? '#3B82F6' : 'var(--border)'}`, background: value && value >= n ? '#3B82F620' : 'var(--surface2)', color: value && value >= n ? '#3B82F6' : 'var(--text3)', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            ★
          </button>
        ))}
        <span style={{ fontSize: 12, color: 'var(--text3)', alignSelf: 'center', marginLeft: 4 }}>
          {value ? ['','Poor','Below avg','Average','Good','Excellent'][value] : 'Not rated'}
        </span>
      </div>
    </div>
  );
}

function FormRow({ label, children }: { label: string; children: React.ReactNode }) {
  return <div style={{ marginBottom: 14 }}><label className="field-label">{label}</label>{children}</div>;
}

export default function SessionFeedbackForm({ sessionId, caseId, onClose, onSaved }: {
  sessionId: string; caseId: string; onClose: () => void; onSaved: () => void;
}) {
  const session = store.getSessions().find(s => s.id === sessionId);
  const existing = store.getFeedbackBySession(sessionId);

  const [form, setForm] = useState<Partial<SessionFeedback>>({
    session_id: sessionId, case_id: caseId,
    child_presentation: existing?.child_presentation,
    interaction_quality: existing?.interaction_quality,
    nrp_engagement: existing?.nrp_engagement,
    environment_suitability: existing?.environment_suitability,
    session_summary: existing?.session_summary || '',
    child_welfare_notes: existing?.child_welfare_notes || '',
    concerns_raised: existing?.concerns_raised || '',
    recommendations: existing?.recommendations || '',
    frequency_recommendation: existing?.frequency_recommendation || 'maintain',
    completed_by: 'Sarah Chen',
  });
  const [saved, setSaved] = useState(false);

  function save(submit = false) {
    store.saveFeedback({ ...form });
    if (submit) store.submitFeedback(sessionId);
    setSaved(true);
    setTimeout(() => { onSaved(); onClose(); }, 600);
  }

  if (!session) return null;

  return (
    <div className="fade-in">
      {/* Session header */}
      <div className="card-sm" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>{session.family_name} family — Session feedback</div>
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>
              {formatDate(session.scheduled_start)} · {formatTime(session.scheduled_start)} · {sessionTypeLabel[session.session_type]} · {session.room}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>Supervisor: {session.supervisor} · Attendees: {session.attendees.join(', ') || '—'}</div>
          </div>
          <button className="btn-ghost" style={{ fontSize: 12 }} onClick={onClose}>Back</button>
        </div>
      </div>

      {/* Ratings */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="section-label">Session ratings</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <StarRating label="Child presentation / wellbeing" value={form.child_presentation} onChange={v => setForm(p => ({ ...p, child_presentation: v }))} />
          <StarRating label="Quality of NRP–child interaction" value={form.interaction_quality} onChange={v => setForm(p => ({ ...p, interaction_quality: v }))} />
          <StarRating label="NRP engagement & cooperation" value={form.nrp_engagement} onChange={v => setForm(p => ({ ...p, nrp_engagement: v }))} />
          <StarRating label="Room / environment suitability" value={form.environment_suitability} onChange={v => setForm(p => ({ ...p, environment_suitability: v }))} />
        </div>
      </div>

      {/* Written fields */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="section-label">Narrative fields</div>
        <FormRow label="Session summary (required)">
          <textarea className="field" style={{ minHeight: 100 }} value={form.session_summary}
            onChange={e => setForm(p => ({ ...p, session_summary: e.target.value }))}
            placeholder="Provide a narrative summary of the session, including what activities took place, how the children responded, and the general tone of contact..." />
        </FormRow>
        <FormRow label="Child welfare observations">
          <textarea className="field" style={{ minHeight: 72 }} value={form.child_welfare_notes}
            onChange={e => setForm(p => ({ ...p, child_welfare_notes: e.target.value }))}
            placeholder="Comment on each child's presentation — appearance, mood, comfort level, any marks or disclosures..." />
        </FormRow>
        <FormRow label="Concerns raised (if any)">
          <textarea className="field" style={{ minHeight: 60 }} value={form.concerns_raised}
            onChange={e => setForm(p => ({ ...p, concerns_raised: e.target.value }))}
            placeholder="Any concerns about the NRP's behaviour, communication, or the child's reaction..." />
        </FormRow>
        <FormRow label="Recommendations">
          <textarea className="field" style={{ minHeight: 60 }} value={form.recommendations}
            onChange={e => setForm(p => ({ ...p, recommendations: e.target.value }))}
            placeholder="Recommended actions, changes, or observations for next session..." />
        </FormRow>
        <FormRow label="Frequency recommendation">
          <select className="field" value={form.frequency_recommendation} onChange={e => setForm(p => ({ ...p, frequency_recommendation: e.target.value }))}>
            <option value="maintain">Maintain current frequency</option>
            <option value="increase">Increase frequency</option>
            <option value="reduce">Reduce frequency</option>
            <option value="suspend">Recommend suspension pending review</option>
            <option value="close">Recommend case closure</option>
          </select>
        </FormRow>
      </div>

      {saved ? (
        <div style={{ textAlign: 'center', padding: '16px', fontSize: 14, color: '#10B981' }}>✓ Feedback saved</div>
      ) : (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn-ghost" onClick={() => save(false)}>Save draft</button>
          <button className="btn-primary" onClick={() => save(true)}
            style={{ opacity: form.session_summary?.trim() ? 1 : 0.4 }}>
            Submit feedback
          </button>
        </div>
      )}
    </div>
  );
}

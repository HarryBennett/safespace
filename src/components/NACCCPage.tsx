'use client';
import { useState } from 'react';
import { store, NACCCReport } from '@/lib/store';
import { formatDate, formatDateTime, sessionTypeLabel } from '@/lib/ui';

function Badge({ cls, label }: { cls: string; label: string }) {
  return <span className={`badge ${cls}`}>{label}</span>;
}

function reportStatusBadge(s: string) {
  return { draft: 'bg-slate-700/40 text-slate-300 border border-slate-600/30', signed: 'bg-blue-900/30 text-blue-300 border border-blue-800/40', submitted: 'bg-green-900/30 text-green-300 border border-green-800/40' }[s] || '';
}

function Modal({ title, subtitle, onClose, children, wide }: {
  title: string; subtitle?: string; onClose: () => void; children: React.ReactNode; wide?: boolean;
}) {
  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box fade-in" style={{ maxWidth: wide ? 700 : 480 }}>
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

// ── Generate report modal ─────────────────────────────────────────────────────
function GenerateReportModal({ caseId, onClose, onCreated }: {
  caseId?: string; onClose: () => void; onCreated: (id: string) => void;
}) {
  const cases = store.getCases().filter(c => c.status === 'active');
  const today = new Date().toISOString().split('T')[0];
  const firstOfMonth = today.slice(0, 8) + '01';
  const [selCase, setSelCase] = useState(caseId || cases[0]?.id || '');
  const [periodStart, setPeriodStart] = useState(firstOfMonth);
  const [periodEnd, setPeriodEnd] = useState(today);

  const c = store.getCaseById(selCase);
  const preview = c ? (() => {
    const sessions = store.getSessionsByCase(selCase).filter(s =>
      s.scheduled_start >= periodStart && s.scheduled_start <= periodEnd
    );
    const notes = sessions.flatMap(s => s.notes);
    return {
      completed: sessions.filter(s => s.status === 'completed').length,
      dna: sessions.filter(s => s.status === 'dna').length,
      cancelled: sessions.filter(s => s.status === 'cancelled').length,
      welfare: notes.filter(n => n.note_type === 'welfare_concern').length,
      incidents: notes.filter(n => n.note_type === 'incident').length,
      total: sessions.length,
    };
  })() : null;

  function generate() {
    const r = store.generateNACCCReport(selCase, periodStart, periodEnd, 'Sarah Chen');
    onCreated(r.id);
    onClose();
  }

  return (
    <Modal title="Generate NACCC report" subtitle="Auto-populated from session data for the selected period." onClose={onClose}>
      {!caseId && (
        <FormRow label="Case">
          <select className="field" value={selCase} onChange={e => setSelCase(e.target.value)}>
            {cases.map(c => <option key={c.id} value={c.id}>{c.case_ref} — {c.family_name} family</option>)}
          </select>
        </FormRow>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <FormRow label="Period start">
          <input type="date" className="field" value={periodStart} onChange={e => setPeriodStart(e.target.value)} />
        </FormRow>
        <FormRow label="Period end">
          <input type="date" className="field" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} />
        </FormRow>
      </div>

      {preview && (
        <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: 14, marginBottom: 14 }}>
          <div className="section-label" style={{ marginBottom: 10 }}>Data preview for this period</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
            {[
              { label: 'Sessions completed', value: preview.completed, color: '#10B981' },
              { label: 'DNA', value: preview.dna, color: preview.dna > 0 ? '#F59E0B' : undefined },
              { label: 'Cancelled', value: preview.cancelled },
              { label: 'Welfare concerns', value: preview.welfare, color: preview.welfare > 0 ? '#EF4444' : undefined },
              { label: 'Incidents', value: preview.incidents, color: preview.incidents > 0 ? '#EF4444' : undefined },
              { label: 'Total sessions', value: preview.total },
            ].map(m => (
              <div key={m.label} style={{ textAlign: 'center', padding: '8px', background: 'var(--surface3)', borderRadius: 6 }}>
                <div style={{ fontSize: 22, fontWeight: 600, color: m.color || 'var(--text)' }}>{m.value}</div>
                <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>{m.label}</div>
              </div>
            ))}
          </div>
          {preview.total === 0 && (
            <div style={{ fontSize: 12, color: '#F59E0B', marginTop: 10, textAlign: 'center' }}>
              No sessions found in this period. Adjust the dates.
            </div>
          )}
        </div>
      )}

      <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 14, lineHeight: 1.6 }}>
        The report will be created in <strong style={{ color: 'var(--text2)' }}>Draft</strong> status. You can then edit the summary and recommendations before signing and submitting.
      </div>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 12, borderTop: '1px solid var(--border)' }}>
        <button className="btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={generate}
          style={{ opacity: preview && preview.total > 0 ? 1 : 0.4 }}>
          Generate report →
        </button>
      </div>
    </Modal>
  );
}

// ── Report editor / viewer ────────────────────────────────────────────────────
function ReportEditor({ reportId, onClose, onUpdate }: {
  reportId: string; onClose: () => void; onUpdate: () => void;
}) {
  const r = store.getNACCCReports().find(x => x.id === reportId);
  if (!r) return null;
  // Use a stable ref so destructuring below always has a value
  const report = r;

  const [summary, setSummary] = useState(r.summary);
  const [recommendations, setRecommendations] = useState(r.recommendations);
  const [saving, setSaving] = useState(false);
  const [signing, setSigning] = useState(false);

  const c = store.getCaseById(r.case_id);
  const sessions = store.getSessionsByCase(r.case_id).filter(s =>
    s.scheduled_start >= r.period_start && s.scheduled_start <= r.period_end
  );
  const allNotes = sessions.flatMap(s => s.notes);
  const welfareConcerns = allNotes.filter(n => n.note_type === 'welfare_concern');
  const incidents = allNotes.filter(n => n.note_type === 'incident');

  function save(newStatus?: NACCCReport['status']) {
    setSaving(true);
    store.updateNACCCReport(r!.id, {
      summary,
      recommendations,
      status: newStatus || r!.status,
      manager_sign: newStatus === 'signed' ? 'Director J. Walsh' : r!.manager_sign,
    });
    onUpdate();
    setTimeout(() => { setSaving(false); if (newStatus === 'submitted') onClose(); }, 400);
  }

  function sign() {
    setSigning(true);
    setTimeout(() => {
      save('signed');
      setSigning(false);
    }, 500);
  }

  function submit() { save('submitted'); }

  return (
    <Modal title={`NACCC Report — ${r.family_name} family`}
      subtitle={`${formatDate(r.period_start)} to ${formatDate(r.period_end)} · ${r.status}`}
      onClose={onClose} wide>

      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 8, marginBottom: 16 }}>
        {[
          { label: 'Completed', value: r.session_count, color: '#10B981' },
          { label: 'DNA', value: r.dna_count, color: r.dna_count > 0 ? '#F59E0B' : undefined },
          { label: 'Cancelled', value: r.cancelled_count },
          { label: 'Welfare concerns', value: r.welfare_concerns_count, color: r.welfare_concerns_count > 0 ? '#EF4444' : undefined },
          { label: 'Incidents', value: r.incidents_count, color: r.incidents_count > 0 ? '#EF4444' : undefined },
        ].map(m => (
          <div key={m.label} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px', textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 600, color: m.color || 'var(--text)', lineHeight: 1 }}>{m.value}</div>
            <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 3 }}>{m.label}</div>
          </div>
        ))}
      </div>

      {/* Session list */}
      {sessions.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div className="section-label">Sessions in period</div>
          <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead><tr style={{ background: 'var(--surface2)' }}>
                <th style={{ padding: '7px 12px', textAlign: 'left', color: 'var(--text3)', fontWeight: 500 }}>Date</th>
                <th style={{ padding: '7px 12px', textAlign: 'left', color: 'var(--text3)', fontWeight: 500 }}>Type</th>
                <th style={{ padding: '7px 12px', textAlign: 'left', color: 'var(--text3)', fontWeight: 500 }}>Supervisor</th>
                <th style={{ padding: '7px 12px', textAlign: 'left', color: 'var(--text3)', fontWeight: 500 }}>Attendees</th>
                <th style={{ padding: '7px 12px', textAlign: 'left', color: 'var(--text3)', fontWeight: 500 }}>Status</th>
                <th style={{ padding: '7px 12px', textAlign: 'right', color: 'var(--text3)', fontWeight: 500 }}>Notes</th>
              </tr></thead>
              <tbody>
                {sessions.map(s => (
                  <tr key={s.id} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px 12px', color: 'var(--text)', fontFamily: 'DM Mono, monospace', fontSize: 11 }}>{formatDate(s.scheduled_start)}</td>
                    <td style={{ padding: '8px 12px', color: 'var(--text2)' }}>{sessionTypeLabel[s.session_type]}</td>
                    <td style={{ padding: '8px 12px', color: 'var(--text3)' }}>{s.supervisor}</td>
                    <td style={{ padding: '8px 12px', color: 'var(--text3)' }}>{s.attendees.join(', ') || '—'}</td>
                    <td style={{ padding: '8px 12px' }}>
                      <Badge cls={s.status === 'completed' ? 'bg-green-900/30 text-green-300 border border-green-800/40' : s.status === 'dna' ? 'bg-amber-900/30 text-amber-300 border border-amber-800/40' : 'bg-slate-700/40 text-slate-300 border border-slate-600/30'} label={s.status} />
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text3)' }}>{s.notes.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Welfare concerns */}
      {welfareConcerns.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div className="section-label">Welfare concerns</div>
          {welfareConcerns.map(n => (
            <div key={n.id} style={{ padding: '10px 12px', background: '#EF444408', border: '1px solid #EF444425', borderRadius: 8, marginBottom: 6, fontSize: 13, color: 'var(--text)', lineHeight: 1.6 }}>
              <div style={{ fontSize: 11, color: '#F87171', marginBottom: 4 }}>{n.author} · {formatDateTime(n.created_at)}</div>
              {n.body}
            </div>
          ))}
        </div>
      )}

      {/* Editable fields */}
      <div style={{ marginBottom: 14 }}>
        <label className="field-label">Narrative summary</label>
        <textarea className="field" style={{ minHeight: 120 }} value={summary}
          onChange={e => setSummary(e.target.value)}
          disabled={r.status === 'submitted'}
          placeholder="Provide a narrative summary of contact during this period, including quality of interaction, any concerns, and progress..." />
      </div>
      <div style={{ marginBottom: 14 }}>
        <label className="field-label">Recommendations</label>
        <textarea className="field" style={{ minHeight: 80 }} value={recommendations}
          onChange={e => setRecommendations(e.target.value)}
          disabled={r.status === 'submitted'}
          placeholder="e.g. Continue supervised contact at current frequency. Recommend parenting support referral." />
      </div>

      {/* Signature block */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
        <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: 12 }}>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Supervisor sign</div>
          <div style={{ fontSize: 13, fontWeight: 500, color: r.supervisor_sign ? '#10B981' : 'var(--text3)' }}>
            {r.supervisor_sign ? `✓ ${r.supervisor_sign}` : 'Not signed'}
          </div>
          {r.generated_at && <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>{formatDate(r.generated_at)}</div>}
        </div>
        <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: 12 }}>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Manager sign</div>
          <div style={{ fontSize: 13, fontWeight: 500, color: r!.manager_sign ? '#10B981' : 'var(--text3)' }}>
            {r.manager_sign ? `✓ ${r.manager_sign}` : 'Awaiting manager'}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', paddingTop: 12, borderTop: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {r.status === 'draft' && (
            <>
              <button className="btn-ghost" onClick={() => save()}>Save draft</button>
              <button className="btn-primary" onClick={sign} style={{ opacity: summary.trim() && recommendations.trim() ? 1 : 0.4 }}>
                {signing ? 'Signing...' : 'Sign report'}
              </button>
            </>
          )}
          {r.status === 'signed' && (
            <button className="btn-primary" style={{ background: '#10B981' }} onClick={submit}>
              Submit to NACCC →
            </button>
          )}
          {r.status === 'submitted' && (
            <span style={{ fontSize: 13, color: '#10B981', alignSelf: 'center' }}>✓ Submitted to NACCC</span>
          )}
        </div>
        <button className="btn-ghost" onClick={onClose}>Close</button>
      </div>
    </Modal>
  );
}

// ── Main NACCC reports page ───────────────────────────────────────────────────
export default function NACCCPage({ caseId }: { caseId?: string }) {
  const [showGenerate, setShowGenerate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const bump = () => setRefresh(r => r + 1);

  const all = caseId ? store.getNACCCReportsByCase(caseId) : store.getNACCCReports();
  const drafts = all.filter(r => r.status === 'draft').length;

  return (
    <div className="fade-in">
      {showGenerate && <GenerateReportModal caseId={caseId} onClose={() => setShowGenerate(false)} onCreated={(id) => { bump(); setEditingId(id); }} />}
      {editingId && <ReportEditor reportId={editingId} onClose={() => { setEditingId(null); bump(); }} onUpdate={bump} />}

      {/* Drafts banner */}
      {drafts > 0 && (
        <div style={{ background: '#F59E0B08', border: '1px solid #F59E0B30', borderRadius: 10, padding: '14px 18px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 34, height: 34, borderRadius: 8, background: '#F59E0B20', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#F59E0B', fontSize: 16, flexShrink: 0 }}>📋</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>
              {drafts} report{drafts !== 1 ? 's' : ''} in draft — requires completion and signing
            </div>
            <div style={{ fontSize: 12, color: 'var(--text2)' }}>
              NACCC accreditation requires all reports to be signed and submitted within 28 days of period end.
            </div>
          </div>
        </div>
      )}

      {/* Metrics */}
      {!caseId && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 18 }}>
          {[
            { label: 'Total reports', value: all.length },
            { label: 'Signed / submitted', value: all.filter(r => r.status !== 'draft').length, color: '#10B981' },
            { label: 'Draft', value: drafts, color: drafts > 0 ? '#F59E0B' : undefined },
          ].map(m => (
            <div key={m.label} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px' }}>
              <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 6 }}>{m.label}</div>
              <div style={{ fontSize: 28, fontWeight: 600, color: m.color || 'var(--text)', lineHeight: 1 }}>{m.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* NACCC info bar */}
      <div style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#93C5FD', lineHeight: 1.6 }}>
        📋 NACCC-aligned reports are auto-populated from session data. Complete the narrative summary and recommendations, have the supervisor and manager sign, then submit. All reports are stored permanently for accreditation audits.
      </div>

      {/* Reports table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
          <span className="section-label" style={{ marginBottom: 0 }}>NACCC session reports</span>
          <button className="btn-primary" style={{ fontSize: 12 }} onClick={() => setShowGenerate(true)}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="currentColor"><path d="M6.5 1v11M1 6.5h11"/></svg>
            Generate report
          </button>
        </div>

        {all.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)', marginBottom: 6 }}>No reports yet</div>
            <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 16 }}>
              Generate your first NACCC report from session data.
            </div>
            <button className="btn-primary" onClick={() => setShowGenerate(true)}>Generate first report</button>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Case</th>
                <th>Period</th>
                <th>Sessions</th>
                <th>DNA</th>
                <th>Welfare concerns</th>
                <th>Generated by</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {all.map(r => (
                <tr key={r.id} onClick={() => setEditingId(r.id)}>
                  <td>
                    <div>{r.family_name} family</div>
                    <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#3B82F6' }}>{r.case_ref}</div>
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--text2)' }}>
                    {formatDate(r.period_start)} – {formatDate(r.period_end)}
                  </td>
                  <td style={{ color: 'var(--text2)' }}>{r.session_count}</td>
                  <td style={{ color: r.dna_count > 0 ? '#F59E0B' : 'var(--text3)' }}>{r.dna_count}</td>
                  <td style={{ color: r.welfare_concerns_count > 0 ? '#F87171' : 'var(--text3)' }}>{r.welfare_concerns_count}</td>
                  <td style={{ color: 'var(--text3)' }}>{r.generated_by}</td>
                  <td><Badge cls={reportStatusBadge(r.status)} label={r.status} /></td>
                  <td onClick={e => e.stopPropagation()}>
                    <button className="btn-ghost" style={{ padding: '4px 10px', fontSize: 11 }} onClick={() => setEditingId(r.id)}>
                      {r.status === 'draft' ? 'Edit' : 'View'}
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

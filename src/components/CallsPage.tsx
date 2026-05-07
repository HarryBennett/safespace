'use client';
import { useState, useEffect, useRef } from 'react';
import { store, storeExt } from '@/lib/store';
import { formatDateTime, formatDate } from '@/lib/ui';
import { formatDuration, MOCK_CALL_HISTORY, CallRecord } from '@/lib/callUtils';

const MOCK_STAFF_ID = 'st1';

// ── Duration timer for active call tracking ───────────────────────────────────
function useCallTimer(active: boolean) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!active) { setSeconds(0); return; }
    const id = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(id);
  }, [active]);
  return seconds;
}

// ── Click-to-call with post-call log prompt ───────────────────────────────────
function ClickToCallButton({ number, name, caseId, caseName, party }: {
  number: string; name: string; caseId?: string; caseName?: string;
  party?: string;
}) {
  const [state, setState] = useState<'idle' | 'calling' | 'logging'>('idle');
  const [summary, setSummary] = useState('');
  const [action, setAction] = useState('');
  const callSeconds = useCallTimer(state === 'calling');
  const [loggedDuration, setLoggedDuration] = useState(0);

  function startCall() {
    window.open(`tel:${number}`, '_self');
    setState('calling');
  }

  function endCall() {
    setLoggedDuration(callSeconds);
    setState('logging');
  }

  async function saveLog() {
    await fetch('/api/calls/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        caseId, staffId: MOCK_STAFF_ID, staffName: 'Sarah Chen',
        direction: 'outbound', phoneNumber: number,
        partyName: name, party: party || 'other',
        durationSeconds: loggedDuration, summary,
        actionRequired: action || undefined,
        communicatedAt: new Date(Date.now() - loggedDuration * 1000).toISOString(),
        callId: `manual_${Date.now()}`,
      }),
    });

    // Update in-memory store for immediate UI refresh
    storeExt.addCommLog({
      case_id: caseId || '',
      direction: 'outbound', channel: 'phone', party: party as any || 'other',
      party_name: name,
      subject: `Phone call — ${formatDuration(loggedDuration)}`,
      summary: summary || `Outbound call to ${name} — ${formatDuration(loggedDuration)}`,
      action_required: action || undefined,
      logged_by: 'Sarah Chen',
      communicated_at: new Date(Date.now() - loggedDuration * 1000).toISOString(),
    });

    setState('idle');
    setSummary('');
    setAction('');
  }

  if (state === 'logging') {
    return (
      <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: 14, marginTop: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10B981' }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Log call with {name}</span>
          <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, color: 'var(--text3)' }}>({formatDuration(loggedDuration)})</span>
        </div>
        <div style={{ marginBottom: 10 }}>
          <label className="field-label">Call summary</label>
          <textarea className="field" style={{ minHeight: 70 }} value={summary}
            onChange={e => setSummary(e.target.value)}
            placeholder="What was discussed? Any decisions made or information shared?" />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label className="field-label">Action required (optional)</label>
          <input className="field" value={action} onChange={e => setAction(e.target.value)}
            placeholder="e.g. Send written confirmation by Friday" />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => setState('idle')}>Skip</button>
          <button className="btn-primary" style={{ fontSize: 12, opacity: summary.trim() ? 1 : 0.4 }} onClick={saveLog}>
            Save call log
          </button>
        </div>
      </div>
    );
  }

  if (state === 'calling') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: '#10B98110', border: '1px solid #10B98130', borderRadius: 8 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10B981', animation: 'livePulse 1.4s infinite' }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>Calling {name}…</div>
          <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, color: '#10B981' }}>
            {String(Math.floor(callSeconds / 60)).padStart(2, '0')}:{String(callSeconds % 60).padStart(2, '0')}
          </div>
        </div>
        <button className="btn-danger" style={{ fontSize: 12 }} onClick={endCall}>End & log</button>
      </div>
    );
  }

  return (
    <button
      onClick={startCall}
      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text2)', fontSize: 12, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}
    >
      📞 {number}
    </button>
  );
}

// ── Manual call log modal ─────────────────────────────────────────────────────
function ManualLogModal({ caseId, onClose, onLogged }: {
  caseId?: string; onClose: () => void; onLogged: () => void;
}) {
  const today = new Date().toISOString().slice(0, 16);
  const [form, setForm] = useState({
    direction: 'inbound', phoneNumber: '', partyName: '', party: 'social_worker',
    duration_mins: 0, duration_secs: 0, summary: '', action: '', when: today,
    selCase: caseId || store.getCases()[0]?.id || '',
  });

  async function submit() {
    if (!form.summary.trim() || !form.phoneNumber.trim()) return;
    const durationSeconds = form.duration_mins * 60 + form.duration_secs;
    const selectedCase = store.getCaseById(form.selCase);

    await fetch('/api/calls/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        caseId: form.selCase, staffId: MOCK_STAFF_ID, staffName: 'Sarah Chen',
        direction: form.direction, phoneNumber: form.phoneNumber,
        partyName: form.partyName, party: form.party,
        durationSeconds, summary: form.summary,
        actionRequired: form.action || undefined,
        communicatedAt: new Date(form.when).toISOString(),
        callId: `manual_${Date.now()}`,
      }),
    });

    storeExt.addCommLog({
      case_id: form.selCase,
      direction: form.direction as any, channel: 'phone', party: form.party as any,
      party_name: form.partyName || form.phoneNumber,
      subject: form.direction === 'missed' ? 'Missed call' : `Phone call — ${form.duration_mins}m${form.duration_secs}s`,
      summary: form.summary,
      action_required: form.action || undefined,
      logged_by: 'Sarah Chen',
      communicated_at: new Date(form.when).toISOString(),
    });

    onLogged(); onClose();
  }

  const cases = store.getCases();

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box fade-in" style={{ maxWidth: 520 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>Log phone call</h2>
            <p style={{ fontSize: 12, color: 'var(--text3)' }}>Manually log a call not captured automatically.</p>
          </div>
          <button onClick={onClose} className="btn-ghost" style={{ padding: '5px 8px' }}>✕</button>
        </div>

        {!caseId && (
          <div style={{ marginBottom: 14 }}>
            <label className="field-label">Case</label>
            <select className="field" value={form.selCase} onChange={e => setForm(p => ({ ...p, selCase: e.target.value }))}>
              {cases.map(c => <option key={c.id} value={c.id}>{c.case_ref} — {c.family_name} family</option>)}
              <option value="">Unknown / no case</option>
            </select>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div style={{ marginBottom: 14 }}>
            <label className="field-label">Direction</label>
            <select className="field" value={form.direction} onChange={e => setForm(p => ({ ...p, direction: e.target.value }))}>
              <option value="inbound">Inbound (they called us)</option>
              <option value="outbound">Outbound (we called them)</option>
              <option value="missed">Missed call</option>
            </select>
          </div>
          <div style={{ marginBottom: 14 }}>
            <label className="field-label">Party type</label>
            <select className="field" value={form.party} onChange={e => setForm(p => ({ ...p, party: e.target.value }))}>
              <option value="social_worker">Social worker</option>
              <option value="cafcass">Cafcass officer</option>
              <option value="solicitor">Solicitor</option>
              <option value="court">Court</option>
              <option value="resident_parent">Resident parent</option>
              <option value="non_resident_parent">Non-resident parent</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div style={{ marginBottom: 14 }}>
            <label className="field-label">Their name</label>
            <input className="field" value={form.partyName} onChange={e => setForm(p => ({ ...p, partyName: e.target.value }))} placeholder="e.g. K. Bridges" />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label className="field-label">Phone number</label>
            <input className="field" type="tel" value={form.phoneNumber} onChange={e => setForm(p => ({ ...p, phoneNumber: e.target.value }))} placeholder="+44 1256 000000" />
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label className="field-label">Date & time of call</label>
          <input type="datetime-local" className="field" value={form.when} onChange={e => setForm(p => ({ ...p, when: e.target.value }))} />
        </div>

        {form.direction !== 'missed' && (
          <div style={{ marginBottom: 14 }}>
            <label className="field-label">Duration</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="number" className="field" style={{ width: 80 }} min={0} max={120}
                value={form.duration_mins} onChange={e => setForm(p => ({ ...p, duration_mins: Number(e.target.value) }))} />
              <span style={{ fontSize: 13, color: 'var(--text3)' }}>min</span>
              <input type="number" className="field" style={{ width: 80 }} min={0} max={59}
                value={form.duration_secs} onChange={e => setForm(p => ({ ...p, duration_secs: Number(e.target.value) }))} />
              <span style={{ fontSize: 13, color: 'var(--text3)' }}>sec</span>
            </div>
          </div>
        )}

        <div style={{ marginBottom: 14 }}>
          <label className="field-label">Summary {form.direction !== 'missed' ? '(required)' : ''}</label>
          <textarea className="field" style={{ minHeight: 80 }} value={form.summary}
            onChange={e => setForm(p => ({ ...p, summary: e.target.value }))}
            placeholder="What was discussed? Any decisions, information shared, or concerns raised?" />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label className="field-label">Action required (optional)</label>
          <input className="field" value={form.action} onChange={e => setForm(p => ({ ...p, action: e.target.value }))}
            placeholder="e.g. Send written update by end of week" />
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 12, borderTop: '1px solid var(--border)' }}>
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={submit}
            style={{ opacity: form.summary.trim() && form.phoneNumber.trim() ? 1 : 0.4 }}>
            Save call log
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Unmatched call review ─────────────────────────────────────────────────────
function UnmatchedCallRow({ call, cases, onTagged }: {
  call: CallRecord;
  cases: Array<{ id: string; case_ref: string; family_name: string }>;
  onTagged: () => void;
}) {
  const [selCase, setSelCase] = useState('');
  const [tagged, setTagged] = useState(false);

  async function tag() {
    if (!selCase) return;
    const c = cases.find(x => x.id === selCase);
    storeExt.addCommLog({
      case_id: selCase,
      direction: call.direction === 'outbound' ? 'outbound' : 'inbound',
      channel: 'phone',
      party: 'other',
      party_name: call.from_name || call.from_number,
      subject: call.direction === 'missed' ? 'Missed call (manually tagged)' : `Phone call — ${formatDuration(call.duration_seconds)} (manually tagged)`,
      summary: `${call.direction} call with ${call.from_name || call.from_number}. Duration: ${formatDuration(call.duration_seconds)}. Tagged manually.`,
      logged_by: 'Sarah Chen',
      communicated_at: call.started_at,
    });
    setTagged(true);
    onTagged();
  }

  if (tagged) return null;

  const dirColor = call.direction === 'missed' ? '#F87171' : call.direction === 'outbound' ? '#3B82F6' : '#10B981';
  const dirLabel = call.direction === 'missed' ? '↗ MISSED' : call.direction === 'outbound' ? '↑ OUT' : '↓ IN';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: 10, fontWeight: 700, color: dirColor, width: 56, flexShrink: 0 }}>{dirLabel}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>
          {call.from_name || call.from_number}
          {call.from_name && <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 6 }}>{call.from_number}</span>}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text3)' }}>
          {formatDateTime(call.started_at)} · {formatDuration(call.duration_seconds)}
        </div>
      </div>
      <select className="field" style={{ width: 200, fontSize: 12 }} value={selCase} onChange={e => setSelCase(e.target.value)}>
        <option value="">— Tag to case —</option>
        {cases.map(c => <option key={c.id} value={c.id}>{c.case_ref} — {c.family_name}</option>)}
      </select>
      <button className="btn-primary" style={{ fontSize: 12, opacity: selCase ? 1 : 0.4 }} onClick={tag}>Tag</button>
    </div>
  );
}

// ── Main calls page ───────────────────────────────────────────────────────────
export default function CallsPage() {
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{
    total_scanned: number; auto_logged: number;
    unmatched: CallRecord[];
  } | null>(null);
  const [showManual, setShowManual] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const bump = () => setRefresh(r => r + 1);

  const cases = store.getCases();
  const allCalls = storeExt.getAllCommLogs().filter((c: any) => c.channel === 'phone');
  const missedUnreturned = allCalls.filter((c: any) => c.direction === 'inbound' && c.subject?.includes('Missed') && c.action_required).length;

  async function syncNow() {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch('/api/calls/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staffId: MOCK_STAFF_ID, staffName: 'Sarah Chen', useMock: true }),
      });
      const data = await res.json();
      // Map mock call history to CallRecord shape for unmatched display
      setSyncResult({
        total_scanned: data.total_scanned || MOCK_CALL_HISTORY.length,
        auto_logged: data.auto_logged || 0,
        unmatched: MOCK_CALL_HISTORY.filter(c => !['c1','c2','c3','c4'].includes(c.id)).slice(0, 3),
      });
      bump();
    } catch (e) {
      console.error('Sync error', e);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="fade-in">
      {showManual && <ManualLogModal onClose={() => setShowManual(false)} onLogged={bump} />}

      {/* Connection + sync panel */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 10, background: '#10B98120', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>📞</div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 3 }}>Google Voice — connected</div>
              <div style={{ fontSize: 12, color: 'var(--text3)' }}>sarah@yourdomain.co.uk · Auto-logging enabled · Syncs every 15 min</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => setShowManual(true)}>📝 Log manually</button>
            <button className="btn-ghost" style={{ fontSize: 12 }} onClick={syncNow} disabled={syncing}>
              {syncing ? '⟳ Syncing...' : '⟳ Sync now'}
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
          {[
            { label: 'Calls logged today', value: allCalls.filter((c: any) => new Date(c.communicated_at) > new Date(Date.now() - 86400000)).length },
            { label: 'Missed unreturned', value: missedUnreturned, color: missedUnreturned > 0 ? '#F87171' : undefined },
            { label: 'Centre number', value: process.env.NEXT_PUBLIC_CENTRE_NUMBER || '+44 1256 000000' },
            { label: 'Auto-recording', value: 'All calls' },
            { label: 'Twilio inbound', value: 'Active' },
          ].map(m => (
            <div key={m.label}>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 2 }}>{m.label}</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: m.color || 'var(--text)' }}>{m.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Sync result */}
      {syncResult && (
        <div style={{ marginBottom: 16, padding: '12px 16px', background: '#10B98110', border: '1px solid #10B98140', borderRadius: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
            Sync complete — {syncResult.auto_logged} call{syncResult.auto_logged !== 1 ? 's' : ''} auto-logged from {syncResult.total_scanned} scanned
          </div>
          {syncResult.unmatched.length > 0 && (
            <div style={{ fontSize: 12, color: 'var(--text2)' }}>
              {syncResult.unmatched.length} call{syncResult.unmatched.length !== 1 ? 's' : ''} could not be matched — review below.
            </div>
          )}
        </div>
      )}

      {/* Missed calls alert */}
      {missedUnreturned > 0 && (
        <div style={{ marginBottom: 16, padding: '12px 14px', background: '#EF444408', border: '1px solid #EF444425', borderRadius: 8, display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ fontSize: 16 }}>📵</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>{missedUnreturned} missed call{missedUnreturned !== 1 ? 's' : ''} awaiting callback</div>
            <div style={{ fontSize: 12, color: 'var(--text2)' }}>These are flagged with action required in the call log below.</div>
          </div>
        </div>
      )}

      {/* Unmatched calls for manual tagging */}
      {syncResult?.unmatched && syncResult.unmatched.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="section-label">Unmatched calls — tag to a case</div>
          {syncResult.unmatched.map(call => (
            <UnmatchedCallRow key={call.id} call={call} cases={cases} onTagged={bump} />
          ))}
        </div>
      )}

      {/* Quick-dial panel — all case contacts */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="section-label">Quick dial — active case contacts</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {cases.filter(c => c.status === 'active').slice(0, 4).map(c => (
            <div key={c.id} style={{ padding: '12px', background: 'var(--surface2)', borderRadius: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 6 }}>
                {c.family_name} family
                <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#3B82F6', marginLeft: 8 }}>{c.case_ref}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {c.social_worker && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 11, color: 'var(--text3)' }}>SW: {c.social_worker.split(' – ')[0]}</span>
                    <ClickToCallButton
                      number="+441256501234"  // Demo number — real app pulls from case record
                      name={c.social_worker.split(' – ')[0]}
                      caseId={c.id}
                      party="social_worker"
                    />
                  </div>
                )}
                {c.cafcass_officer && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 11, color: 'var(--text3)' }}>Cafcass: {c.cafcass_officer}</span>
                    <ClickToCallButton
                      number="+441256789012"
                      name={c.cafcass_officer}
                      caseId={c.id}
                      party="cafcass"
                    />
                  </div>
                )}
                {!c.social_worker && !c.cafcass_officer && (
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>No contact numbers stored</div>
                )}
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text3)' }}>
          💡 Clicking a number opens your phone app. After the call, a log prompt will appear to capture duration and summary.
        </div>
      </div>

      {/* Full call log */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
          <span className="section-label" style={{ marginBottom: 0 }}>All logged calls</span>
          <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => setShowManual(true)}>+ Manual entry</button>
        </div>

        {allCalls.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
            No calls logged yet. Run a sync or add a manual entry.
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Direction</th>
                <th>Party</th>
                <th>Case</th>
                <th>Summary</th>
                <th>Duration</th>
                <th>Date & time</th>
                <th>Source</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {allCalls.map((call: any, i: number) => {
                const caseData = call.case_id ? store.getCaseById(call.case_id) : null;
                const isMissed = call.subject?.includes('Missed') || call.direction === 'missed';
                const dirColor = isMissed ? '#F87171' : call.direction === 'outbound' ? '#3B82F6' : '#10B981';
                const dirLabel = isMissed ? '↗ Missed' : call.direction === 'outbound' ? '↑ Out' : '↓ In';

                return (
                  <tr key={i}>
                    <td>
                      <span style={{ fontSize: 11, fontWeight: 600, color: dirColor }}>{dirLabel}</span>
                    </td>
                    <td>
                      <div style={{ fontSize: 13 }}>{call.party_name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>{call.party?.replace('_', ' ')}</div>
                    </td>
                    <td>
                      {caseData
                        ? <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#3B82F6' }}>{caseData.case_ref}</span>
                        : <span style={{ fontSize: 11, color: '#F59E0B' }}>Untagged</span>
                      }
                    </td>
                    <td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text3)', fontSize: 12 }}>
                      {call.summary}
                    </td>
                    <td style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, color: 'var(--text3)' }}>
                      {call.call_duration_seconds ? formatDuration(call.call_duration_seconds) : isMissed ? 'Missed' : '—'}
                    </td>
                    <td style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: 'var(--text3)' }}>
                      {formatDateTime(call.communicated_at)}
                    </td>
                    <td>
                      <span style={{ fontSize: 10, color: 'var(--text3)' }}>
                        {call.source === 'google_voice' ? '🎙 GVoice' :
                         call.source === 'twilio' ? '📡 Twilio' : '👤 Manual'}
                      </span>
                    </td>
                    <td>
                      {call.action_required && (
                        <span style={{ fontSize: 10, padding: '2px 6px', background: '#F59E0B15', border: '1px solid #F59E0B30', borderRadius: 4, color: '#FBBF24' }}>Action needed</span>
                      )}
                      {call.recording_url && call.recording_url !== '#' && (
                        <button className="btn-ghost" style={{ padding: '3px 8px', fontSize: 11, marginLeft: 4 }}
                          onClick={() => window.open(`/api/calls/recording?callId=${call.call_id}`)}>
                          🎙 Play
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ── Case-level call log (used in case detail comms tab) ───────────────────────
export function CaseCallLog({ caseId }: { caseId: string }) {
  const [showManual, setShowManual] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const bump = () => setRefresh(r => r + 1);
  const calls = storeExt.getCommLogs(caseId).filter((c: any) => c.channel === 'phone');
  const c = store.getCaseById(caseId);

  return (
    <div>
      {showManual && <ManualLogModal caseId={caseId} onClose={() => setShowManual(false)} onLogged={bump} />}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 12 }}>
        {c?.social_worker && (
          <ClickToCallButton
            number="+441256501234"
            name={c.social_worker.split(' – ')[0]}
            caseId={caseId}
            party="social_worker"
          />
        )}
        <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => setShowManual(true)}>📝 Log call</button>
      </div>

      {calls.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--text3)' }}>No calls logged for this case yet.</p>
      ) : (
        calls.map((call: any, i: number) => {
          const isMissed = call.subject?.includes('Missed');
          const dirColor = isMissed ? '#F87171' : call.direction === 'outbound' ? '#3B82F6' : '#10B981';
          return (
            <div key={i} style={{ display: 'flex', gap: 14, padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, minWidth: 44 }}>
                <div style={{ fontSize: 18 }}>📞</div>
                <div style={{ fontSize: 10, color: dirColor, fontWeight: 700 }}>
                  {isMissed ? 'MISSED' : call.direction === 'outbound' ? '↑ OUT' : '↓ IN'}
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{call.party_name}</span>
                  <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'DM Mono, monospace' }}>{formatDateTime(call.communicated_at)}</span>
                  {call.call_duration_seconds > 0 && <span style={{ fontSize: 11, color: 'var(--text3)' }}>· {formatDuration(call.call_duration_seconds)}</span>}
                  <span style={{ fontSize: 10, color: 'var(--text3)' }}>
                    {call.source === 'google_voice' ? '🎙 Auto' : call.source === 'twilio' ? '📡 Auto' : '👤 Manual'}
                  </span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6, marginBottom: call.action_required ? 8 : 0 }}>
                  {call.summary}
                </div>
                {call.action_required && (
                  <div style={{ fontSize: 12, background: '#F59E0B10', border: '1px solid #F59E0B30', borderRadius: 6, padding: '5px 10px', color: '#FBBF24', display: 'inline-block', marginTop: 4 }}>
                    → Action: {call.action_required}
                  </div>
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

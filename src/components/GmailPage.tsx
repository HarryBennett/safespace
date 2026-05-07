'use client';
import { useState, useEffect } from 'react';
import { store, storeExt } from '@/lib/store';
import { formatDateTime } from '@/lib/ui';

// ── Gmail connection status ───────────────────────────────────────────────────

interface GmailStatus {
  connected: boolean;
  email?: string;
  token_valid?: boolean;
  last_sync?: string;
  emails_logged_today?: number;
}

// Simulated for prototype
const MOCK_STAFF_ID = 'st1';

// ── Compose email modal ───────────────────────────────────────────────────────
export function ComposeEmailModal({ caseId, onClose, onSent }: {
  caseId: string; onClose: () => void; onSent: () => void;
}) {
  const c = store.getCaseById(caseId);
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState(`Re: ${c?.case_ref || ''} — ${c?.family_name || ''} family`);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  // Quick-fill suggestions based on case contacts
  const suggestions = [
    c?.social_worker && `${c.social_worker.split(' – ')[0].trim()}`,
    c?.cafcass_officer && `${c.cafcass_officer}`,
  ].filter(Boolean);

  async function send() {
    if (!to.trim() || !subject.trim() || !message.trim()) return;
    setSending(true);
    setError('');
    try {
      const res = await fetch('/api/gmail/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staffId: MOCK_STAFF_ID,
          staffName: 'Sarah Chen',
          to: [to.trim()],
          subject: subject.trim(),
          message: message.trim(),
          caseId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Send failed');
      setSent(true);
      onSent();
      setTimeout(onClose, 1200);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to send. Check Gmail connection.');
      setSending(false);
    }
  }

  if (sent) {
    return (
      <div className="modal-backdrop">
        <div className="modal-box fade-in" style={{ maxWidth: 440, textAlign: 'center', padding: '32px 24px' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>✓</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>Email sent</div>
          <div style={{ fontSize: 13, color: 'var(--text3)' }}>Automatically logged to the communication record for {c?.family_name} family.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box fade-in" style={{ maxWidth: 600 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>Send email</h2>
            <p style={{ fontSize: 12, color: 'var(--text3)' }}>Sent via your Google Workspace account. Auto-logged to comms record.</p>
          </div>
          <button onClick={onClose} className="btn-ghost" style={{ padding: '5px 8px' }}>✕</button>
        </div>

        {/* Quick-fill contacts */}
        {suggestions.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6 }}>Quick fill from case contacts:</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {suggestions.map((s, i) => (
                <button key={i} className="btn-ghost" style={{ fontSize: 11, padding: '3px 10px' }}
                  onClick={() => setTo(s || '')}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        <div style={{ marginBottom: 10 }}>
          <label className="field-label">To</label>
          <input className="field" value={to} onChange={e => setTo(e.target.value)} placeholder="recipient@organisation.gov.uk" type="email" />
        </div>
        <div style={{ marginBottom: 10 }}>
          <label className="field-label">Subject</label>
          <input className="field" value={subject} onChange={e => setSubject(e.target.value)} />
        </div>
        <div style={{ marginBottom: 14 }}>
          <label className="field-label">Message</label>
          <textarea className="field" style={{ minHeight: 160 }} value={message} onChange={e => setMessage(e.target.value)}
            placeholder="Type your message here..." />
        </div>

        <div style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 7, padding: '9px 12px', fontSize: 12, color: '#93C5FD', marginBottom: 14 }}>
          📧 This email will be sent from your Google Workspace account and automatically logged to the {c?.family_name} family communication record with timestamp and recipient.
        </div>

        {error && <div style={{ fontSize: 12, color: '#F87171', marginBottom: 10, padding: '8px 12px', background: '#EF444412', borderRadius: 6 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={send}
            style={{ opacity: !sending && to.trim() && subject.trim() && message.trim() ? 1 : 0.5 }}>
            {sending ? 'Sending...' : '📤 Send email'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Unmatched email review panel ──────────────────────────────────────────────
function UnmatchedEmailRow({ email, cases, onLogged }: {
  email: { gmail_id: string; subject: string; from: string; date: string };
  cases: Array<{ id: string; case_ref: string; family_name: string }>;
  onLogged: () => void;
}) {
  const [selCase, setSelCase] = useState('');
  const [logged, setLogged] = useState(false);

  function manualLog() {
    if (!selCase) return;
    // In production: POST to /api/gmail/sync with manual override
    storeExt.addCommLog({
      case_id: selCase,
      direction: 'inbound',
      channel: 'email',
      party: 'other',
      party_name: email.from,
      subject: email.subject,
      summary: '(Email retrieved from Gmail — body available in Gmail)',
      logged_by: 'Sarah Chen (manual tag)',
      communicated_at: email.date,
    });
    setLogged(true);
    onLogged();
  }

  if (logged) return null;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{email.subject || '(No subject)'}</div>
        <div style={{ fontSize: 11, color: 'var(--text3)' }}>From: {email.from} · {formatDateTime(email.date)}</div>
      </div>
      <select className="field" style={{ width: 200, fontSize: 12 }} value={selCase} onChange={e => setSelCase(e.target.value)}>
        <option value="">— Tag to case —</option>
        {cases.map(c => <option key={c.id} value={c.id}>{c.case_ref} — {c.family_name}</option>)}
      </select>
      <button className="btn-primary" style={{ fontSize: 12 }} onClick={manualLog}
        disabled={!selCase}>Log</button>
    </div>
  );
}

// ── Main Gmail settings / inbox panel ────────────────────────────────────────
export default function GmailPage() {
  const [status, setStatus] = useState<GmailStatus | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ auto_logged: number; unmatched: { gmail_id: string; subject: string; from: string; date: string }[] } | null>(null);
  const [refresh, setRefresh] = useState(0);

  const cases = store.getCases();
  const recentComms = storeExt.getAllCommLogs().filter((c: { channel: string }) => c.channel === 'email').slice(0, 20);

  // Check connection status
  useEffect(() => {
    fetch(`/api/gmail/sync?staffId=${MOCK_STAFF_ID}`)
      .then(r => r.json())
      .then(setStatus)
      .catch(() => setStatus({ connected: false }));
  }, [refresh]);

  function connectGmail() {
    // In production: redirect to /api/gmail/connect which generates auth URL
    const authUrl = `/api/gmail/callback?mock=true`; // Demo
    window.open(`https://accounts.google.com/o/oauth2/v2/auth?client_id=${process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || 'demo'}&redirect_uri=${encodeURIComponent(window.location.origin + '/api/gmail/callback')}&response_type=code&scope=https://www.googleapis.com/auth/gmail.readonly+https://www.googleapis.com/auth/gmail.send&access_type=offline&state=${encodeURIComponent(JSON.stringify({ staffId: MOCK_STAFF_ID, returnTo: '/settings' }))}`, '_blank');
  }

  async function syncNow() {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch('/api/gmail/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staffId: MOCK_STAFF_ID, staffName: 'Sarah Chen' }),
      });
      const data = await res.json();
      setSyncResult(data);
      setRefresh(r => r + 1);
    } catch (e) {
      console.error('Sync error', e);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="fade-in">
      {/* Connection card */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 10, background: status?.connected ? '#10B98120' : 'var(--surface3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
              {status?.connected ? '📧' : '🔌'}
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 3 }}>
                {status?.connected ? 'Gmail connected' : 'Gmail not connected'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                {status?.connected
                  ? `${status.email} · Auto-logging enabled`
                  : 'Connect your Google Workspace account to enable automatic email logging'}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {status?.connected ? (
              <>
                <button className="btn-ghost" style={{ fontSize: 12 }} onClick={syncNow} disabled={syncing}>
                  {syncing ? '⟳ Syncing...' : '⟳ Sync now'}
                </button>
                <button className="btn-ghost" style={{ fontSize: 12, color: '#F87171' }}
                  onClick={async () => {
                    await fetch('/api/gmail/disconnect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ staffId: MOCK_STAFF_ID }) });
                    setStatus({ connected: false });
                  }}>
                  Disconnect
                </button>
              </>
            ) : (
              <button className="btn-primary" onClick={connectGmail}>
                Connect Google Workspace →
              </button>
            )}
          </div>
        </div>

        {status?.connected && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
            {[
              { label: 'Auto-sync', value: 'Every 15 minutes' },
              { label: 'Push notifications', value: 'Active (real-time)' },
              { label: 'Emails logged today', value: recentComms.length },
            ].map(m => (
              <div key={m.label}>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 2 }}>{m.label}</div>
                <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{m.value}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sync result */}
      {syncResult && (
        <div style={{ marginBottom: 16, padding: '12px 16px', background: syncResult.auto_logged > 0 ? '#10B98110' : 'var(--surface2)', border: `1px solid ${syncResult.auto_logged > 0 ? '#10B98140' : 'var(--border)'}`, borderRadius: 8, fontSize: 13 }}>
          <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
            Sync complete — {syncResult.auto_logged} email{syncResult.auto_logged !== 1 ? 's' : ''} auto-logged
          </div>
          {syncResult?.unmatched?.length > 0 && (
            <div style={{ color: 'var(--text2)' }}>{syncResult.unmatched?.length || syncResult?.unmatched?.length} emails could not be matched to a case — review below to tag manually.</div>
          )}
        </div>
      )}

      {/* Unmatched emails */}
      {syncResult?.unmatched && syncResult.unmatched.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="section-label">Unmatched emails — manual tagging required</div>
          {syncResult.unmatched.map(e => (
            <UnmatchedEmailRow key={e.gmail_id} email={e} cases={cases} onLogged={() => setRefresh(r => r + 1)} />
          ))}
        </div>
      )}

      {/* How matching works */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="section-label">Auto-matching rules</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {[
            { confidence: 'High', icon: '🎯', label: 'Case ref in subject/body', example: 'e.g. "BST-2026-0041"' },
            { confidence: 'High', icon: '🎯', label: 'Court order ref in body', example: 'e.g. "WN/2026/FC/00841"' },
            { confidence: 'High', icon: '🎯', label: 'Known contact email match', example: 'Social worker or Cafcass email' },
            { confidence: 'Medium', icon: '📌', label: 'Family name in subject', example: 'e.g. "Morris family contact"' },
          ].map(r => (
            <div key={r.label} style={{ display: 'flex', gap: 10, padding: '10px 12px', background: 'var(--surface2)', borderRadius: 8 }}>
              <div style={{ fontSize: 18 }}>{r.icon}</div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', marginBottom: 2 }}>{r.label}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>{r.example}</div>
                <div style={{ fontSize: 10, color: r.confidence === 'High' ? '#10B981' : '#F59E0B', marginTop: 2 }}>{r.confidence} confidence</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 12, padding: '10px 12px', background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 7, fontSize: 12, color: '#93C5FD' }}>
          💡 Tip: Include the case reference (e.g. BST-2026-0041) in email subjects when communicating about a case. This guarantees high-confidence auto-matching for all parties involved.
        </div>
      </div>

      {/* Recent auto-logged emails */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
          <span className="section-label" style={{ marginBottom: 0 }}>Recently logged emails (all cases)</span>
        </div>
        {recentComms.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
            No emails logged yet. Connect Gmail and run a sync.
          </div>
        ) : (
          <table className="data-table">
            <thead><tr><th>Dir</th><th>From / To</th><th>Subject</th><th>Case</th><th>Date</th><th>Source</th></tr></thead>
            <tbody>
              {recentComms.map((comm, i: number) => { const c = comm as any;
                const caseData = store.getCaseById(c.case_id);
                return (
                  <tr key={i}>
                    <td>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 6px', borderRadius: 4, background: (c as any).direction === 'inbound' ? '#10B98120' : '#3B82F620', color: (c as any).direction === 'inbound' ? '#10B981' : '#3B82F6' }}>
                        {(c as any).direction === 'inbound' ? '↓ IN' : '↑ OUT'}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text3)', fontSize: 12 }}>{(c as any).party_name}</td>
                    <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(c as any).subject || '(No subject)'}</td>
                    <td>
                      {caseData && <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#3B82F6' }}>{caseData.case_ref}</span>}
                    </td>
                    <td style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: 'var(--text3)' }}>{formatDateTime(c.communicated_at)}</td>
                    <td>
                      <span style={{ fontSize: 10, color: 'var(--text3)' }}>
                        {((c as any).source) === 'gmail_auto' ? '🤖 Auto' : ((c as any).source) === 'gmail_webhook' ? '⚡ Real-time' : ((c as any).source) === 'gmail_sent' ? '📤 Sent' : '👤 Manual'}
                      </span>
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

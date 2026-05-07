'use client';
import { use, useState, useEffect } from 'react';
import { store } from '@/lib/store';
import {
  formatDateTime, formatDate, formatTime, sessionTypeLabel,
  noteTypeLabel, noteTypeBadge, recipientRoleLabel, daysUntil,
  shareLinkStatusLabel, shareLinkStatusBadge
} from '@/lib/ui';

function Badge({ cls, label }: { cls: string; label: string }) {
  return <span className={`badge ${cls}`}>{label}</span>;
}

export default function PortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [authenticated, setAuthenticated] = useState(false);
  const [email, setEmail] = useState('');
  const [magicSent, setMagicSent] = useState(false);
  const [activeTab, setActiveTab] = useState<'sessions' | 'notes' | 'documents'>('sessions');
  const [expandedSession, setExpandedSession] = useState<string | null>(null);

  const link = store.getShareLinkByToken(token);

  useEffect(() => {
    // Simulate: auto-auth if link exists (real app uses email magic link)
    if (link && link.status === 'active') {
      store.logPortalView(token, '192.168.1.1');
    }
  }, [token, link]);

  // Not found or revoked
  if (!link) {
    return (
      <div style={{ minHeight: '100vh', background: '#0C1118', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'DM Sans, sans-serif' }}>
        <div style={{ textAlign: 'center', maxWidth: 400, padding: 24 }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>🔒</div>
          <div style={{ fontSize: 18, fontWeight: 600, color: '#DDE3EF', marginBottom: 8 }}>Link not found</div>
          <div style={{ fontSize: 14, color: '#8A97B0', lineHeight: 1.6 }}>This link does not exist or has been removed. Please contact the contact centre if you believe this is an error.</div>
        </div>
      </div>
    );
  }

  if (link.status === 'expired' || link.status === 'revoked') {
    return (
      <div style={{ minHeight: '100vh', background: '#0C1118', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'DM Sans, sans-serif' }}>
        <div style={{ textAlign: 'center', maxWidth: 420, padding: 24 }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>{link.status === 'expired' ? '⏰' : '🚫'}</div>
          <div style={{ fontSize: 18, fontWeight: 600, color: '#DDE3EF', marginBottom: 8 }}>
            {link.status === 'expired' ? 'This link has expired' : 'This link has been revoked'}
          </div>
          <div style={{ fontSize: 14, color: '#8A97B0', lineHeight: 1.6, marginBottom: 20 }}>
            {link.status === 'expired'
              ? `This secure link expired on ${formatDate(link.expires_at)}. Please contact ${link.case_ref ? 'the centre' : 'SafeSpace'} to request a new link.`
              : 'Access to this shared record has been withdrawn. Please contact the contact centre for further assistance.'}
          </div>
          <div style={{ background: '#1A2230', border: '1px solid #263145', borderRadius: 10, padding: '14px 16px', fontSize: 13, color: '#50617A', textAlign: 'left' }}>
            <div>Issued to: {link.recipient_name}</div>
            <div style={{ marginTop: 4 }}>Case: {link.case_ref} — {link.family_name} family</div>
          </div>
        </div>
      </div>
    );
  }

  if (link.status === 'pending_approval') {
    return (
      <div style={{ minHeight: '100vh', background: '#0C1118', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'DM Sans, sans-serif' }}>
        <div style={{ textAlign: 'center', maxWidth: 420, padding: 24 }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>⏳</div>
          <div style={{ fontSize: 18, fontWeight: 600, color: '#DDE3EF', marginBottom: 8 }}>Awaiting approval</div>
          <div style={{ fontSize: 14, color: '#8A97B0', lineHeight: 1.6 }}>This link is pending manager review. You will receive an email once access has been approved.</div>
        </div>
      </div>
    );
  }

  // Magic link authentication screen
  if (!authenticated) {
    return (
      <div style={{ minHeight: '100vh', background: '#0C1118', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'DM Sans, sans-serif', padding: 20 }}>
        <div style={{ width: '100%', maxWidth: 400 }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{ width: 48, height: 48, background: '#2563EB', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <svg width="22" height="22" viewBox="0 0 22 22" fill="white"><path d="M11 1a8 8 0 100 16A8 8 0 0011 1zm0 3a4 4 0 110 8 4 4 0 010-8z"/><circle cx="11" cy="20" r="2"/></svg>
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#50617A', marginBottom: 8, fontFamily: 'DM Mono, monospace' }}>SafeSpace · Secure Portal</div>
            <div style={{ fontSize: 20, fontWeight: 600, color: '#DDE3EF', marginBottom: 8 }}>Verify your access</div>
            <div style={{ fontSize: 13, color: '#8A97B0', lineHeight: 1.6 }}>
              You have been granted access to records for the <strong style={{ color: '#DDE3EF' }}>{link.family_name} family</strong>. Enter your professional email to receive a one-time login link.
            </div>
          </div>

          {!magicSent ? (
            <div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#50617A', marginBottom: 5 }}>Your professional email</label>
                <input
                  style={{ width: '100%', background: '#1A2230', border: '1px solid #263145', borderRadius: 8, padding: '10px 12px', color: '#DDE3EF', fontFamily: 'DM Sans, sans-serif', fontSize: 14, outline: 'none' }}
                  type="email" placeholder={link.recipient_email} value={email}
                  onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && email && setMagicSent(true)}
                />
              </div>
              <button
                onClick={() => email && setMagicSent(true)}
                style={{ width: '100%', padding: '11px', borderRadius: 9, background: '#2563EB', color: 'white', fontSize: 14, fontWeight: 500, border: 'none', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', opacity: email ? 1 : 0.4 }}
              >
                Send login link
              </button>
              <div style={{ marginTop: 14, fontSize: 12, color: '#50617A', textAlign: 'center', lineHeight: 1.6 }}>
                A one-time secure link will be sent to your email. Your access will be logged.
              </div>
            </div>
          ) : (
            <div>
              <div style={{ background: '#1A2230', border: '1px solid #263145', borderRadius: 10, padding: '20px', textAlign: 'center', marginBottom: 16 }}>
                <div style={{ fontSize: 28, marginBottom: 10 }}>📧</div>
                <div style={{ fontSize: 14, fontWeight: 500, color: '#DDE3EF', marginBottom: 6 }}>Check your email</div>
                <div style={{ fontSize: 13, color: '#8A97B0' }}>A login link has been sent to <strong style={{ color: '#DDE3EF' }}>{email}</strong></div>
              </div>
              {/* In prototype, show bypass for demo */}
              <button
                onClick={() => setAuthenticated(true)}
                style={{ width: '100%', padding: '11px', borderRadius: 9, background: '#1A2230', color: '#8A97B0', fontSize: 13, border: '1px solid #263145', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}
              >
                [Demo] Click here to access portal →
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Authenticated portal view ────────────────────────────────────────────────
  const c = store.getCaseById(link.case_id);
  const allSessions = store.getSessionsByCase(link.case_id);
  const sharedSessions = allSessions.filter(s => link.scope.session_ids.includes(s.id));
  const allNotes = sharedSessions.flatMap(s => {
    if (link.scope.include_notes === 'none') return [];
    if (link.scope.include_notes === 'all') return s.notes.filter(n => n.visible_externally);
    return s.notes.filter(n => n.note_type === link.scope.include_notes && n.visible_externally);
  }).sort((a, b) => b.created_at.localeCompare(a.created_at));
  const docs = link.scope.include_documents ? store.getDocumentsByCase(link.case_id) : [];
  const days = daysUntil(link.expires_at);

  return (
    <div style={{ minHeight: '100vh', background: '#0C1118', fontFamily: 'DM Sans, sans-serif', color: '#DDE3EF' }}>
      {/* Portal header */}
      <div style={{ background: '#131920', borderBottom: '1px solid #263145', padding: '0 24px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', alignItems: 'center', height: 58, gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <div style={{ width: 28, height: 28, background: '#2563EB', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="13" height="13" viewBox="0 0 14 14" fill="white"><path d="M7 1a4.5 4.5 0 100 9A4.5 4.5 0 007 1zm0 2a2.5 2.5 0 110 5A2.5 2.5 0 017 3z"/><circle cx="7" cy="12.5" r="1.5"/></svg>
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#DDE3EF' }}>SafeSpace</div>
          </div>
          <div style={{ height: 18, width: 1, background: '#263145' }}></div>
          <div style={{ fontSize: 12, color: '#50617A', fontFamily: 'DM Mono, monospace' }}>Secure external portal</div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ fontSize: 11, color: days <= 3 ? '#F87171' : '#50617A' }}>
              {days > 0 ? `Access expires in ${days} day${days !== 1 ? 's' : ''}` : 'Access expired'}
            </div>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10B981' }}></div>
            <div style={{ fontSize: 12, color: '#8A97B0' }}>{link.recipient_name}</div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px' }}>
        {/* Security notice */}
        <div style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 8, padding: '10px 14px', marginBottom: 20, display: 'flex', gap: 10, alignItems: 'center', fontSize: 12, color: '#93C5FD' }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" style={{ flexShrink: 0 }}><path d="M7 1l5 2v4c0 3-2.5 5.5-5 6C4.5 12.5 2 10 2 7V3L7 1z"/></svg>
          Your access to this record is being logged. All views are attributed to {link.recipient_email} and are admissible in court proceedings. You may view but not download recordings.
        </div>

        {/* Case header */}
        <div style={{ background: '#131920', border: '1px solid #263145', borderRadius: 12, padding: '18px 20px', marginBottom: 18 }}>
          <div style={{ fontSize: 11, fontFamily: 'DM Mono, monospace', color: '#3B82F6', marginBottom: 4 }}>{link.case_ref}</div>
          <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 10 }}>{link.family_name} family</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 12, color: '#8A97B0' }}>
            <span>Shared by SafeSpace Basingstoke</span>
            <span>·</span>
            <span>Shared on {formatDate(link.created_at)}</span>
            <span>·</span>
            <span>Access expires {formatDate(link.expires_at)}</span>
            {c?.legal_order_ref && <><span>·</span><span style={{ fontFamily: 'DM Mono, monospace', color: '#3B82F6' }}>{c.legal_order_ref}</span></>}
          </div>
        </div>

        {/* What is shared */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
          <div style={{ background: '#1A2230', border: '1px solid #263145', borderRadius: 10, padding: '13px 14px' }}>
            <div style={{ fontSize: 11, color: '#50617A', marginBottom: 4 }}>Sessions shared</div>
            <div style={{ fontSize: 22, fontWeight: 600, color: '#DDE3EF' }}>{sharedSessions.length}</div>
          </div>
          <div style={{ background: '#1A2230', border: '1px solid #263145', borderRadius: 10, padding: '13px 14px' }}>
            <div style={{ fontSize: 11, color: '#50617A', marginBottom: 4 }}>Notes visible</div>
            <div style={{ fontSize: 22, fontWeight: 600, color: '#DDE3EF' }}>{allNotes.length}</div>
          </div>
          <div style={{ background: '#1A2230', border: '1px solid #263145', borderRadius: 10, padding: '13px 14px' }}>
            <div style={{ fontSize: 11, color: '#50617A', marginBottom: 4 }}>Documents</div>
            <div style={{ fontSize: 22, fontWeight: 600, color: '#DDE3EF' }}>{docs.length}</div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #263145', marginBottom: 18 }}>
          {[
            { key: 'sessions', label: `Sessions (${sharedSessions.length})` },
            { key: 'notes', label: `Notes (${allNotes.length})` },
            ...(docs.length > 0 ? [{ key: 'documents', label: `Documents (${docs.length})` }] : []),
          ].map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key as any)} style={{ padding: '9px 18px', fontSize: 13, fontWeight: 500, border: 'none', background: 'none', color: activeTab === t.key ? '#3B82F6' : '#50617A', borderBottom: activeTab === t.key ? '2px solid #3B82F6' : '2px solid transparent', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', marginBottom: -1 }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Sessions tab */}
        {activeTab === 'sessions' && (
          <div>
            {sharedSessions.map(s => {
              const sessionNotes = s.notes.filter(n => {
                if (link.scope.include_notes === 'none') return false;
                if (link.scope.include_notes === 'all') return n.visible_externally;
                return n.note_type === link.scope.include_notes && n.visible_externally;
              });
              const isExpanded = expandedSession === s.id;
              return (
                <div key={s.id} style={{ background: '#131920', border: '1px solid #263145', borderRadius: 10, marginBottom: 10, overflow: 'hidden' }}>
                  <div onClick={() => setExpandedSession(isExpanded ? null : s.id)} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', cursor: 'pointer' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                        <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, color: '#50617A' }}>{formatDate(s.scheduled_start)}</span>
                        <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, color: '#50617A' }}>{formatTime(s.scheduled_start)}</span>
                        <Badge cls={s.session_type === 'supervised' ? 'bg-red-900/30 text-red-300 border border-red-800/40' : s.session_type === 'supported' ? 'bg-blue-900/30 text-blue-300 border border-blue-800/40' : 'bg-teal-900/30 text-teal-300 border border-teal-800/40'} label={sessionTypeLabel[s.session_type]} />
                        <Badge cls={s.status === 'completed' ? 'bg-blue-900/30 text-blue-300 border border-blue-800/40' : 'bg-slate-700/40 text-slate-300 border border-slate-600/30'} label={s.status} />
                      </div>
                      <div style={{ fontSize: 12, color: '#8A97B0' }}>
                        Supervisor: {s.supervisor} · {s.room} · {s.attendees.length || 0} attendees · {sessionNotes.length} note{sessionNotes.length !== 1 ? 's' : ''}
                      </div>
                    </div>
                    <div style={{ fontSize: 18, color: '#50617A', transition: 'transform 0.15s', transform: isExpanded ? 'rotate(180deg)' : 'none' }}>›</div>
                  </div>
                  {isExpanded && (
                    <div style={{ padding: '0 18px 16px', borderTop: '1px solid #263145' }}>
                      <div style={{ paddingTop: 14 }}>
                        <div style={{ fontSize: 11, color: '#50617A', fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 10 }}>Session details</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 14 }}>
                          <div><div style={{ fontSize: 11, color: '#50617A' }}>Scheduled start</div><div style={{ fontSize: 13, color: '#DDE3EF', fontFamily: 'DM Mono, monospace', marginTop: 2 }}>{formatTime(s.scheduled_start)}</div></div>
                          <div><div style={{ fontSize: 11, color: '#50617A' }}>Actual start</div><div style={{ fontSize: 13, color: '#DDE3EF', fontFamily: 'DM Mono, monospace', marginTop: 2 }}>{s.actual_start ? formatTime(s.actual_start) : '—'}</div></div>
                          <div><div style={{ fontSize: 11, color: '#50617A' }}>Attendees present</div><div style={{ fontSize: 13, color: '#DDE3EF', marginTop: 2 }}>{s.attendees.join(', ') || '—'}</div></div>
                        </div>
                        {sessionNotes.length > 0 && (
                          <div>
                            <div style={{ fontSize: 11, color: '#50617A', fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 8 }}>Notes</div>
                            {sessionNotes.map(n => (
                              <div key={n.id} style={{ background: '#1A2230', borderRadius: 8, padding: '11px 13px', marginBottom: 8 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                                  <Badge cls={noteTypeBadge(n.note_type)} label={noteTypeLabel[n.note_type]} />
                                  <span style={{ fontSize: 11, color: '#50617A', fontFamily: 'DM Mono, monospace' }}>{formatDateTime(n.created_at)}</span>
                                  <span style={{ fontSize: 11, color: '#50617A' }}>· {n.author}</span>
                                </div>
                                <div style={{ fontSize: 13, color: '#DDE3EF', lineHeight: 1.7 }}>{n.body}</div>
                              </div>
                            ))}
                          </div>
                        )}
                        {sessionNotes.length === 0 && link.scope.include_notes !== 'none' && (
                          <div style={{ fontSize: 13, color: '#50617A' }}>No notes shared for this session.</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Notes tab */}
        {activeTab === 'notes' && (
          <div>
            {allNotes.length === 0 && <p style={{ fontSize: 13, color: '#50617A' }}>No notes shared for this access link.</p>}
            {allNotes.map(n => (
              <div key={n.id} style={{ background: '#131920', border: '1px solid #263145', borderRadius: 10, padding: '14px 16px', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <Badge cls={noteTypeBadge(n.note_type)} label={noteTypeLabel[n.note_type]} />
                  <span style={{ fontSize: 12, fontWeight: 500, color: '#8A97B0' }}>{n.author}</span>
                  <span style={{ fontSize: 11, color: '#50617A', fontFamily: 'DM Mono, monospace' }}>{formatDateTime(n.created_at)}</span>
                </div>
                <div style={{ fontSize: 13, color: '#DDE3EF', lineHeight: 1.7 }}>{n.body}</div>
              </div>
            ))}
          </div>
        )}

        {/* Documents tab */}
        {activeTab === 'documents' && (
          <div>
            {docs.length === 0 && <p style={{ fontSize: 13, color: '#50617A' }}>No documents shared.</p>}
            {docs.map(d => (
              <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 16px', background: '#131920', border: '1px solid #263145', borderRadius: 10, marginBottom: 8 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: '#1D4ED815', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#60A5FA', flexShrink: 0 }}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><path d="M2 1a1 1 0 011-1h5.586a1 1 0 01.707.293L12.707 3.707A1 1 0 0113 4.414V13a1 1 0 01-1 1H3a1 1 0 01-1-1V1zm2 5h7v1H4V6zm0 2.5h7v1H4v-1zm0 2.5h5v1H4V11z"/></svg>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#DDE3EF' }}>{d.name}</div>
                  <div style={{ fontSize: 11, color: '#50617A' }}>{d.type} · {d.size} · Uploaded {formatDate(d.uploaded_at)}</div>
                </div>
                <button style={{ padding: '6px 14px', borderRadius: 7, fontSize: 12, fontWeight: 500, background: 'transparent', color: '#8A97B0', border: '1px solid #263145', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}
                  onClick={() => { store.logPortalView(link.token, '192.168.1.1'); alert('[Demo] In production this would stream the document: ' + d.name); }}>
                  View
                </button>
              </div>
            ))}
            <div style={{ fontSize: 12, color: '#50617A', textAlign: 'center', marginTop: 12, padding: '10px', background: '#1A2230', borderRadius: 8 }}>
              🔒 Documents are view-only. Downloads are disabled. All access is logged.
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ borderTop: '1px solid #263145', marginTop: 32, paddingTop: 20, display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#50617A' }}>
          <div>SafeSpace Contact Centre Management · {link.case_ref}</div>
          <div>Access granted to {link.recipient_name} · {recipientRoleLabel[link.recipient_role]}</div>
        </div>
      </div>
    </div>
  );
}

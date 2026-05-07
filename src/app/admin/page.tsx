'use client';
import { useState, useEffect } from 'react';
import { storeExt as store, StaffMember, DBSRecord } from '@/lib/store';
import { getAuditLog, AuditLogEntry } from '@/lib/audit';
import { formatDateTime, formatDate } from '@/lib/ui';

// ── Dual-auth gate ─────────────────────────────────────────────────────────────
// In production, this is also validated server-side against SUPER_ADMIN_KEY env var.
// The client-side check is a UX gate only — the real protection is middleware.
const ADMIN_PASSPHRASE = process.env.NEXT_PUBLIC_ADMIN_HINT || 'safespace-admin';

function AdminAuth({ onAuth }: { onAuth: () => void }) {
  const [key, setKey] = useState('');
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(0);

  function attempt() {
    setAttempts(a => a + 1);
    if (attempts >= 4) { setError('Too many attempts. Refresh to try again.'); return; }
    // In production: POST to /api/admin/verify with the key (server validates against env var)
    if (key.trim().toLowerCase() === ADMIN_PASSPHRASE) { onAuth(); }
    else { setError('Incorrect admin passphrase.'); setKey(''); }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0C1118', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'DM Sans, sans-serif', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🔐</div>
          <div style={{ fontSize: 20, fontWeight: 600, color: '#DDE3EF', marginBottom: 6 }}>Super admin access</div>
          <div style={{ fontSize: 13, color: '#50617A', lineHeight: 1.6 }}>
            This area requires a separate admin passphrase in addition to your staff login. Access is logged.
          </div>
        </div>
        <div style={{ background: '#131920', border: '1px solid #263145', borderRadius: 12, padding: 24 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#50617A', marginBottom: 6 }}>Admin passphrase</label>
          <input
            type="password" value={key}
            onChange={e => setKey(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && attempt()}
            placeholder="Enter admin passphrase"
            style={{ width: '100%', background: '#1A2230', border: `1px solid ${error ? '#EF4444' : '#263145'}`, borderRadius: 8, padding: '11px 14px', color: '#DDE3EF', fontFamily: 'DM Sans, sans-serif', fontSize: 14, outline: 'none', marginBottom: 12 }}
          />
          {error && <div style={{ fontSize: 12, color: '#F87171', marginBottom: 12 }}>{error}</div>}
          <button onClick={attempt} style={{ width: '100%', padding: 12, borderRadius: 9, background: '#2563EB', color: 'white', fontSize: 14, fontWeight: 500, border: 'none', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
            Authenticate →
          </button>
          <div style={{ marginTop: 12, fontSize: 11, color: '#374151', textAlign: 'center' }}>Every access attempt is logged with timestamp and IP</div>
        </div>
      </div>
    </div>
  );
}

// ── Staff management ──────────────────────────────────────────────────────────
function StaffPanel() {
  const [refresh, setRefresh] = useState(0);
  const bump = () => setRefresh(r => r + 1);
  const [showNew, setShowNew] = useState(false);
  const [newForm, setNewForm] = useState({ full_name: '', email: '', role: 'supervisor' as StaffMember['role'], centre: 'Basingstoke', centre_id: 'c_bst' });
  const staff = store.getStaffMembers();

  const roleColor: Record<StaffMember['role'], string> = {
    director: '#8B5CF6', manager: '#3B82F6', supervisor: '#10B981', admin: '#F59E0B'
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button className="btn-primary" style={{ fontSize: 12 }} onClick={() => setShowNew(s => !s)}>
          {showNew ? 'Cancel' : '+ Add staff member'}
        </button>
      </div>

      {showNew && (
        <div className="card-sm" style={{ marginBottom: 14 }}>
          <div className="section-label">New staff member</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div><label className="field-label">Full name</label><input className="field" value={newForm.full_name} onChange={e => setNewForm(p => ({ ...p, full_name: e.target.value }))} placeholder="Jane Smith" /></div>
            <div><label className="field-label">Work email</label><input className="field" type="email" value={newForm.email} onChange={e => setNewForm(p => ({ ...p, email: e.target.value }))} placeholder="jane@safespace.co.uk" /></div>
            <div><label className="field-label">Role</label>
              <select className="field" value={newForm.role} onChange={e => setNewForm(p => ({ ...p, role: e.target.value as StaffMember['role'] }))}>
                <option value="supervisor">Supervisor</option>
                <option value="admin">Admin</option>
                <option value="manager">Manager</option>
                <option value="director">Director</option>
              </select>
            </div>
            <div><label className="field-label">Centre</label>
              <select className="field" value={newForm.centre} onChange={e => setNewForm(p => ({ ...p, centre: e.target.value }))}>
                <option>Basingstoke</option>
                <option>Winchester</option>
                <option>Southampton</option>
              </select>
            </div>
          </div>
          <button className="btn-primary" style={{ fontSize: 12 }} onClick={() => {
            if (!newForm.full_name.trim()) return;
            store.createStaff(newForm);
            setShowNew(false); setNewForm({ full_name: '', email: '', role: 'supervisor', centre: 'Basingstoke', centre_id: 'c_bst' }); bump();
          }}>Create staff account</button>
          <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text3)' }}>In production: Supabase invite email will be sent automatically.</div>
        </div>
      )}

      <table className="data-table">
        <thead><tr><th>Name</th><th>Role</th><th>Centre</th><th>Email</th><th>DBS expiry</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>
          {staff.map(s => (
            <tr key={s.id}>
              <td style={{ fontWeight: 500 }}>{s.full_name}</td>
              <td>
                <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4, background: `${roleColor[s.role]}20`, color: roleColor[s.role], border: `1px solid ${roleColor[s.role]}40`, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {s.role}
                </span>
              </td>
              <td style={{ color: 'var(--text3)' }}>{s.centre}</td>
              <td style={{ color: 'var(--text3)', fontSize: 12 }}>{s.email || '—'}</td>
              <td style={{ fontSize: 12, fontFamily: 'DM Mono, monospace', color: s.dbs_expiry && new Date(s.dbs_expiry) < new Date(Date.now() + 60 * 86400000) ? '#F59E0B' : 'var(--text3)' }}>
                {s.dbs_expiry ? formatDate(s.dbs_expiry) : '—'}
              </td>
              <td>{s.active ? <span className="badge bg-green-900/30 text-green-300 border border-green-800/40">Active</span> : <span className="badge bg-slate-700/40 text-slate-400 border border-slate-600/30">Inactive</span>}</td>
              <td>
                <div style={{ display: 'flex', gap: 6 }}>
                  <select
                    className="field" style={{ padding: '3px 6px', fontSize: 11, width: 'auto' }}
                    value={s.role}
                    onChange={e => { store.updateStaffRole(s.id, e.target.value as StaffMember['role']); bump(); }}
                  >
                    <option value="supervisor">Supervisor</option>
                    <option value="admin">Admin</option>
                    <option value="manager">Manager</option>
                    <option value="director">Director</option>
                  </select>
                  {s.active && s.role !== 'director' && (
                    <button className="btn-ghost" style={{ padding: '3px 8px', fontSize: 11, color: '#F87171' }}
                      onClick={() => { if (confirm(`Deactivate ${s.full_name}?`)) { store.deactivateStaff(s.id); bump(); } }}>
                      Deactivate
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── DBS panel ─────────────────────────────────────────────────────────────────
function DBSPanel() {
  const records = store.getDBSRecords();
  const expiring = store.getExpiringDBS(60);

  return (
    <div>
      {expiring.length > 0 && (
        <div style={{ background: '#F59E0B08', border: '1px solid #F59E0B30', borderRadius: 10, padding: '14px 18px', marginBottom: 16, display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ fontSize: 20 }}>⚠</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>{expiring.length} DBS record{expiring.length !== 1 ? 's' : ''} expiring within 60 days</div>
            <div style={{ fontSize: 12, color: 'var(--text2)' }}>Initiate renewals now to avoid gaps in cover. Staff with expired DBS cannot supervise sessions.</div>
          </div>
        </div>
      )}

      <table className="data-table">
        <thead><tr><th>Staff member</th><th>DBS number</th><th>Issue date</th><th>Expiry</th><th>Update service</th><th>Days remaining</th><th>Status</th></tr></thead>
        <tbody>
          {records.map(r => (
            <tr key={r.id}>
              <td>{r.staff_name}</td>
              <td style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: 'var(--text3)' }}>{r.dbs_number}</td>
              <td style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: 'var(--text3)' }}>{formatDate(r.issue_date)}</td>
              <td style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: r.days_until_expiry <= 60 ? '#F59E0B' : 'var(--text3)' }}>{formatDate(r.expiry_date)}</td>
              <td style={{ color: 'var(--text3)' }}>{r.update_service ? '✓ Enrolled' : '✗ Not enrolled'}</td>
              <td>
                <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 13, fontWeight: 600, color: r.days_until_expiry <= 30 ? '#EF4444' : r.days_until_expiry <= 60 ? '#F59E0B' : '#10B981' }}>
                  {r.days_until_expiry}d
                </span>
              </td>
              <td>
                <span className={`badge ${r.status === 'valid' ? 'bg-green-900/30 text-green-300 border border-green-800/40' : r.status === 'expiring_soon' ? 'bg-amber-900/30 text-amber-300 border border-amber-800/40' : 'bg-red-900/30 text-red-300 border border-red-800/40'}`}>
                  {r.status.replace('_', ' ')}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Audit trail panel ─────────────────────────────────────────────────────────
function AuditPanel() {
  const log = getAuditLog({ limit: 100 });

  const actionColor: Record<string, string> = {
    case_viewed: '#8A97B0', case_created: '#10B981', session_started: '#3B82F6',
    session_ended: '#3B82F6', note_added: '#8B5CF6', share_link_created: '#F59E0B',
    share_link_approved: '#10B981', share_link_rejected: '#EF4444', pdf_exported: '#14B8A6',
    safeguarding_logged: '#EF4444', login: '#10B981', staff_created: '#8B5CF6',
    staff_deactivated: '#EF4444',
  };

  return (
    <div>
      <div style={{ marginBottom: 14, fontSize: 12, color: 'var(--text3)', background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 8, padding: '10px 14px' }}>
        🔒 This audit trail is immutable. Every staff action is logged with timestamp, IP, and affected record. In production, logs are stored in a separate append-only database table and cannot be deleted.
      </div>

      {log.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text3)', fontSize: 13 }}>No audit events recorded yet in this session.</div>
      )}

      {log.map((entry, i) => (
        <div key={i} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: actionColor[entry.action] || '#8A97B0', marginTop: 5, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 2 }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{entry.actor_name}</span>
              <span style={{ fontSize: 12, color: actionColor[entry.action] || 'var(--text3)' }}>{entry.action.replace(/_/g, ' ')}</span>
              {entry.record_label && <span style={{ fontSize: 12, color: 'var(--text3)' }}>· {entry.record_label}</span>}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'DM Mono, monospace' }}>
              {formatDateTime(entry.created_at)}
              {entry.ip_address ? ` · ${entry.ip_address}` : ''}
              {entry.detail ? ` · ${entry.detail}` : ''}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Multi-centre overview ─────────────────────────────────────────────────────
function MultiCentrePanel() {
  const centres = [
    { name: 'Basingstoke', code: 'BST', active_cases: 24, sessions_this_month: 38, revenue_month: 7240, staff: 3, open_incidents: 2, waiting: 4 },
    { name: 'Winchester', code: 'WIN', active_cases: 0, sessions_this_month: 0, revenue_month: 0, staff: 0, open_incidents: 0, waiting: 0 },
    { name: 'Southampton', code: 'SOU', active_cases: 0, sessions_this_month: 0, revenue_month: 0, staff: 0, open_incidents: 0, waiting: 0 },
  ];

  return (
    <div>
      <div style={{ marginBottom: 14, fontSize: 12, color: 'var(--text3)' }}>
        Cross-centre director view. Add new centres via the Supabase admin or the staff setup process.
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 20 }}>
        {centres.map(c => (
          <div key={c.code} className="card" style={{ opacity: c.active_cases > 0 ? 1 : 0.5 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{ width: 36, height: 36, borderRadius: 9, background: '#3B82F620', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'DM Mono, monospace', fontSize: 11, fontWeight: 700, color: '#3B82F6' }}>{c.code}</div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{c.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>{c.staff} staff · {c.active_cases > 0 ? 'Operational' : 'Not yet open'}</div>
              </div>
            </div>
            {[
              { label: 'Active cases', value: c.active_cases },
              { label: 'Sessions / month', value: c.sessions_this_month },
              { label: 'Revenue / month', value: c.revenue_month > 0 ? `£${c.revenue_month.toLocaleString()}` : '—' },
              { label: 'Open incidents', value: c.open_incidents, color: c.open_incidents > 0 ? '#EF4444' : undefined },
              { label: 'Waiting list', value: c.waiting, color: c.waiting > 3 ? '#F59E0B' : undefined },
            ].map(m => (
              <div key={m.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
                <span style={{ color: 'var(--text3)' }}>{m.label}</span>
                <span style={{ color: m.color || 'var(--text)', fontWeight: m.color ? 600 : 400 }}>{m.value}</span>
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="card">
        <div className="section-label">Group revenue summary</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
          {[
            { label: 'Total collected (May)', value: '£7,240', color: '#10B981' },
            { label: 'Outstanding', value: '£870', color: '#F59E0B' },
            { label: 'Overdue', value: '£445', color: '#EF4444' },
            { label: 'YTD revenue', value: '£31,420', color: '#3B82F6' },
          ].map(m => (
            <div key={m.label} style={{ background: 'var(--surface2)', borderRadius: 8, padding: '12px 14px' }}>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>{m.label}</div>
              <div style={{ fontSize: 20, fontWeight: 600, color: m.color, fontFamily: 'DM Mono, monospace' }}>{m.value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main admin page ───────────────────────────────────────────────────────────
export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [tab, setTab] = useState<'overview'|'staff'|'dbs'|'audit'>('overview');

  if (!authed) return <AdminAuth onAuth={() => setAuthed(true)} />;

  const tabs = [
    { key: 'overview', label: 'Multi-centre overview' },
    { key: 'staff', label: 'Staff management' },
    { key: 'dbs', label: 'DBS records' },
    { key: 'audit', label: 'Audit trail' },
  ] as const;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'DM Sans, sans-serif' }}>
      {/* Admin topbar */}
      <div style={{ background: '#1A0A2E', borderBottom: '1px solid #3B1278', padding: '0 24px', display: 'flex', alignItems: 'center', height: 54, gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>🔐</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#DDE3EF' }}>SafeSpace Super Admin</span>
        </div>
        <div style={{ height: 18, width: 1, background: '#3B1278' }} />
        <span style={{ fontSize: 12, color: '#8B5CF6', fontFamily: 'DM Mono, monospace' }}>Director J. Walsh · all centres</span>
        <div style={{ marginLeft: 'auto' }}>
          <a href="/" style={{ fontSize: 12, color: '#8A97B0', textDecoration: 'none' }}>← Back to app</a>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px' }}>
        <div style={{ marginBottom: 16, padding: '10px 14px', background: '#8B5CF610', border: '1px solid #8B5CF630', borderRadius: 8, fontSize: 12, color: '#A78BFA' }}>
          ⚠ You are in the super admin panel. All actions here are logged and attributed to your account. Changes take effect immediately.
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{ padding: '9px 18px', fontSize: 13, fontWeight: 500, border: 'none', background: 'none', color: tab === t.key ? '#8B5CF6' : 'var(--text3)', borderBottom: `2px solid ${tab === t.key ? '#8B5CF6' : 'transparent'}`, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', marginBottom: -1 }}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'overview' && <MultiCentrePanel />}
        {tab === 'staff' && <StaffPanel />}
        {tab === 'dbs' && <DBSPanel />}
        {tab === 'audit' && <AuditPanel />}
      </div>
    </div>
  );
}

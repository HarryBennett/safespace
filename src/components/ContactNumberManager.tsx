'use client';
import { useState } from 'react';
import { store } from '@/lib/store';
import { normaliseNumber } from '@/lib/callUtils';

export interface ContactNumber {
  id: string;
  case_id: string;
  party: string;
  party_name: string;
  phone_number: string;
  number_type: 'direct' | 'mobile' | 'office' | 'home';
  is_primary: boolean;
  verified: boolean;
  notes?: string;
}

// In-memory store for prototype — replace with Supabase in production
const _contactNumbers: ContactNumber[] = [
  { id: 'cn1', case_id: 'c1', party: 'social_worker', party_name: 'K. Bridges', phone_number: '+441256501234', number_type: 'direct', is_primary: true, verified: true },
  { id: 'cn2', case_id: 'c1', party: 'cafcass', party_name: 'P. Sutton', phone_number: '+441962123456', number_type: 'direct', is_primary: true, verified: true },
  { id: 'cn3', case_id: 'c1', party: 'non_resident_parent', party_name: 'David Morris', phone_number: '+447700900456', number_type: 'mobile', is_primary: true, verified: false },
  { id: 'cn4', case_id: 'c3', party: 'social_worker', party_name: 'L. Wade', phone_number: '+441256789012', number_type: 'direct', is_primary: true, verified: true },
];

export function getContactNumbers(caseId: string): ContactNumber[] {
  return _contactNumbers.filter(n => n.case_id === caseId);
}

export function addContactNumber(num: Omit<ContactNumber, 'id'>): ContactNumber {
  const n = { ...num, id: Math.random().toString(36).slice(2), phone_number: normaliseNumber(num.phone_number) };
  _contactNumbers.push(n);
  return n;
}

export function getAllContactNumbers(): ContactNumber[] {
  return _contactNumbers;
}

// ── Component ─────────────────────────────────────────────────────────────────

const partyLabels: Record<string, string> = {
  social_worker: 'Social worker', cafcass: 'Cafcass', solicitor: 'Solicitor',
  court: 'Court', resident_parent: 'Resident parent',
  non_resident_parent: 'Non-resident parent', other: 'Other',
};

function FormRow({ label, children }: { label: string; children: React.ReactNode }) {
  return <div style={{ marginBottom: 12 }}><label className="field-label">{label}</label>{children}</div>;
}

export default function ContactNumberManager({ caseId }: { caseId: string }) {
  const [showAdd, setShowAdd] = useState(false);
  const [numbers, setNumbers] = useState(() => getContactNumbers(caseId));
  const [form, setForm] = useState({
    party: 'social_worker', party_name: '', phone_number: '',
    number_type: 'direct' as ContactNumber['number_type'],
    is_primary: false, notes: '',
  });
  const [error, setError] = useState('');

  const c = store.getCaseById(caseId);

  function add() {
    if (!form.phone_number.trim() || !form.party_name.trim()) return;
    try {
      const n = addContactNumber({ ...form, case_id: caseId, verified: false });
      setNumbers(prev => [...prev, n]);
      setShowAdd(false);
      setForm({ party: 'social_worker', party_name: '', phone_number: '', number_type: 'direct', is_primary: false, notes: '' });
      setError('');
    } catch {
      setError('Invalid phone number — use format: 01256 123456 or +44 1256 123456');
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div className="section-label" style={{ marginBottom: 0 }}>Contact phone numbers</div>
        <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => setShowAdd(s => !s)}>
          {showAdd ? 'Cancel' : '+ Add number'}
        </button>
      </div>

      {/* Security notice */}
      <div style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 7, padding: '9px 12px', marginBottom: 14, fontSize: 12, color: '#93C5FD' }}>
        📞 Numbers stored here are used to automatically match incoming calls from Google Voice and the Twilio centre number to this case.
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="card-sm" style={{ marginBottom: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <FormRow label="Party type">
              <select className="field" value={form.party} onChange={e => setForm(p => ({ ...p, party: e.target.value }))}>
                {Object.entries(partyLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </FormRow>
            <FormRow label="Name">
              <input className="field" value={form.party_name} onChange={e => setForm(p => ({ ...p, party_name: e.target.value }))} placeholder="e.g. K. Bridges" />
            </FormRow>
            <FormRow label="Phone number">
              <input className="field" type="tel" value={form.phone_number} onChange={e => setForm(p => ({ ...p, phone_number: e.target.value }))} placeholder="01256 123456" />
            </FormRow>
            <FormRow label="Number type">
              <select className="field" value={form.number_type} onChange={e => setForm(p => ({ ...p, number_type: e.target.value as any }))}>
                <option value="direct">Direct line</option>
                <option value="mobile">Mobile</option>
                <option value="office">Office / switchboard</option>
                <option value="home">Home</option>
              </select>
            </FormRow>
          </div>
          <FormRow label="Notes (optional)">
            <input className="field" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="e.g. Best time to call: Mon–Fri 9–5" />
          </FormRow>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text2)', cursor: 'pointer', marginBottom: 12 }}>
            <input type="checkbox" checked={form.is_primary} onChange={e => setForm(p => ({ ...p, is_primary: e.target.checked }))} style={{ accentColor: '#3B82F6' }} />
            Primary number for this contact
          </label>
          {error && <div style={{ fontSize: 12, color: '#F87171', marginBottom: 10 }}>{error}</div>}
          <button className="btn-primary" style={{ fontSize: 12 }} onClick={add}
>
            Save number
          </button>
        </div>
      )}

      {/* Number list */}
      {numbers.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--text3)', padding: '12px 0' }}>
          No contact numbers stored. Add numbers to enable automatic call matching.
        </div>
      ) : (
        <div>
          {numbers.map(n => (
            <div key={n.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: 'var(--surface2)', borderRadius: 8, marginBottom: 6, border: '1px solid var(--border)' }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#3B82F620', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>
                {n.number_type === 'mobile' ? '📱' : '📞'}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{n.party_name}</span>
                  <span style={{ fontSize: 11, color: 'var(--text3)' }}>{partyLabels[n.party] || n.party}</span>
                  {n.is_primary && <span className="badge bg-blue-900/30 text-blue-300 border border-blue-800/40">Primary</span>}
                  {n.verified
                    ? <span style={{ fontSize: 10, color: '#10B981' }}>✓ Verified</span>
                    : <span style={{ fontSize: 10, color: '#F59E0B' }}>⚠ Unverified</span>
                  }
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, color: '#3B82F6' }}>{n.phone_number}</span>
                  <span style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'capitalize' }}>{n.number_type}</span>
                  {n.notes && <span style={{ fontSize: 11, color: 'var(--text3)' }}>· {n.notes}</span>}
                </div>
              </div>
              <a href={`tel:${n.phone_number}`} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--surface3)', color: '#10B981', fontSize: 12, textDecoration: 'none', fontFamily: 'DM Sans, sans-serif' }}>
                📞 Call
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

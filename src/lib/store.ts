// In-memory store — replace with Supabase in production
// Phase 2 additions: ShareLink, AuditLog, Approval workflow

export type RiskFlag = 'domestic_violence' | 'court_injunction' | 'safeguarding' | 'legal_proceedings' | 'prohibited_steps_order';
export type ReferralSource = 'local_authority' | 'private' | 'cafcass' | 'court_ordered';
export type CaseStatus = 'intake' | 'active' | 'suspended' | 'closed' | 'archived';
export type SessionType = 'supervised' | 'supported' | 'handover';
export type SessionStatus = 'scheduled' | 'in_progress' | 'completed' | 'dna' | 'cancelled';
export type NoteType = 'observation' | 'welfare_concern' | 'incident' | 'recommendation';

export interface Person {
  id: string;
  name: string;
  dob?: string;
  role: 'child' | 'resident_parent' | 'non_resident_parent';
}

export interface Case {
  id: string;
  case_ref: string;
  family_name: string;
  referral_source: ReferralSource;
  status: CaseStatus;
  risk_flags: RiskFlag[];
  keyworker: string;
  centre: string;
  legal_order_ref?: string;
  social_worker?: string;
  cafcass_officer?: string;
  persons: Person[];
  created_at: string;
}

export interface Note {
  id: string;
  session_id?: string;
  case_id: string;
  note_type: NoteType;
  body: string;
  author: string;
  created_at: string;
  visible_externally: boolean;
}

export interface Session {
  id: string;
  case_id: string;
  case_ref: string;
  family_name: string;
  session_type: SessionType;
  scheduled_start: string;
  scheduled_end: string;
  actual_start?: string;
  actual_end?: string;
  supervisor: string;
  room: string;
  status: SessionStatus;
  attendees: string[];
  notes: Note[];
  created_at: string;
}

export interface Document {
  id: string;
  case_id: string;
  name: string;
  type: string;
  uploaded_by: string;
  uploaded_at: string;
  size: string;
}

// ── Phase 3 types ─────────────────────────────────────────────────────────────

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
export type PaymentMethod = 'invoice' | 'stripe' | 'bacs';
export type InvoiceLineType = 'supervised_session' | 'supported_session' | 'handover_session' | 'report_fee' | 'admin_fee' | 'other';

export interface InvoiceLine {
  id: string;
  description: string;
  type: InvoiceLineType;
  quantity: number;
  unit_price: number;
  total: number;
  session_id?: string;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  case_id: string;
  case_ref: string;
  family_name: string;
  client_name: string;
  client_email: string;
  client_type: 'local_authority' | 'private' | 'cafcass';
  lines: InvoiceLine[];
  subtotal: number;
  vat: number;
  total: number;
  status: InvoiceStatus;
  payment_method: PaymentMethod;
  issued_at?: string;
  due_at?: string;
  paid_at?: string;
  stripe_payment_link?: string;
  notes?: string;
  created_by: string;
  created_at: string;
}

export type SafeguardingStatus = 'open' | 'referred' | 'closed' | 'monitoring';
export type SafeguardingCategory = 'physical_harm' | 'emotional_harm' | 'neglect' | 'sexual_harm' | 'domestic_violence' | 'parental_behaviour' | 'other';

export interface SafeguardingIncident {
  id: string;
  case_id: string;
  case_ref: string;
  family_name: string;
  session_id?: string;
  category: SafeguardingCategory;
  description: string;
  immediate_action_taken: string;
  reported_by: string;
  reported_at: string;
  status: SafeguardingStatus;
  referral_agency?: string;
  referral_ref?: string;
  referral_date?: string;
  manager_review?: string;
  manager_reviewed_at?: string;
  outcome?: string;
  closed_at?: string;
  children_involved: string[];
  follow_up_actions: string[];
}

export interface NACCCReport {
  id: string;
  case_id: string;
  case_ref: string;
  family_name: string;
  period_start: string;
  period_end: string;
  generated_by: string;
  generated_at: string;
  session_count: number;
  dna_count: number;
  cancelled_count: number;
  welfare_concerns_count: number;
  incidents_count: number;
  summary: string;
  recommendations: string;
  supervisor_sign: string;
  manager_sign?: string;
  status: 'draft' | 'signed' | 'submitted';
}

// ── Phase 2 types ─────────────────────────────────────────────────────────────

export type RecipientRole = 'social_worker' | 'cafcass' | 'solicitor' | 'court' | 'other';
export type ShareLinkStatus = 'pending_approval' | 'active' | 'expired' | 'revoked';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface ShareScope {
  session_ids: string[];       // which sessions are shared
  include_notes: 'all' | 'welfare_concern' | 'observation' | 'none';
  include_documents: boolean;
  include_recordings: boolean;
}

export interface AuditEntry {
  id: string;
  share_link_id: string;
  event: 'created' | 'approved' | 'rejected' | 'viewed' | 'document_opened' | 'revoked' | 'expired';
  actor: string;              // name or email of who did it
  ip?: string;
  user_agent?: string;
  created_at: string;
  detail?: string;
}

export interface ShareLink {
  id: string;
  token: string;              // uuid used in the URL
  case_id: string;
  case_ref: string;
  family_name: string;
  recipient_name: string;
  recipient_email: string;
  recipient_role: RecipientRole;
  scope: ShareScope;
  purpose: string;            // reason for sharing
  expires_at: string;
  status: ShareLinkStatus;
  approval_status: ApprovalStatus;
  approved_by?: string;
  approved_at?: string;
  rejection_reason?: string;
  created_by: string;
  created_at: string;
  audit_log: AuditEntry[];
  view_count: number;
}

function caseRef(centre: string, year: number, seq: number) {
  return `${centre.toUpperCase().slice(0, 3)}-${year}-${String(seq).padStart(4, '0')}`;
}

const y = new Date().getFullYear();
const today = new Date().toISOString().split('T')[0];

const SEED_CASES: Case[] = [
  {
    id: 'c1', case_ref: caseRef('BST', y, 41), family_name: 'Morris',
    referral_source: 'local_authority', status: 'active',
    risk_flags: ['domestic_violence', 'court_injunction', 'legal_proceedings'],
    keyworker: 'Sarah Chen', centre: 'Basingstoke',
    legal_order_ref: 'WN/2026/FC/00841',
    social_worker: 'K. Bridges – Hampshire CC', cafcass_officer: 'P. Sutton',
    persons: [
      { id: 'p1', name: 'Emily Morris', dob: '2019-03-14', role: 'child' },
      { id: 'p2', name: 'James Morris', dob: '2021-09-02', role: 'child' },
      { id: 'p3', name: 'Claire Morris', role: 'resident_parent' },
      { id: 'p4', name: 'David Morris', role: 'non_resident_parent' },
    ],
    created_at: `${y}-01-15T09:00:00Z`,
  },
  {
    id: 'c2', case_ref: caseRef('BST', y, 38), family_name: 'Patel',
    referral_source: 'private', status: 'active',
    risk_flags: ['legal_proceedings'],
    keyworker: 'James Okafor', centre: 'Basingstoke',
    social_worker: '', cafcass_officer: '',
    persons: [
      { id: 'p5', name: 'Aisha Patel', dob: '2018-07-22', role: 'child' },
      { id: 'p6', name: 'Priya Patel', role: 'resident_parent' },
      { id: 'p7', name: 'Raj Patel', role: 'non_resident_parent' },
    ],
    created_at: `${y}-02-03T10:00:00Z`,
  },
  {
    id: 'c3', case_ref: caseRef('BST', y, 35), family_name: 'Johnson',
    referral_source: 'cafcass', status: 'active',
    risk_flags: ['safeguarding', 'legal_proceedings'],
    keyworker: 'James Okafor', centre: 'Basingstoke',
    legal_order_ref: 'WN/2025/FC/01122',
    social_worker: 'L. Wade – Hampshire CC', cafcass_officer: 'R. Holmes',
    persons: [
      { id: 'p8', name: 'Tyler Johnson', dob: '2017-11-30', role: 'child' },
      { id: 'p9', name: 'Sophie Johnson', role: 'resident_parent' },
      { id: 'p10', name: 'Mark Johnson', role: 'non_resident_parent' },
    ],
    created_at: `${y - 1}-11-20T09:00:00Z`,
  },
  {
    id: 'c4', case_ref: caseRef('BST', y, 29), family_name: 'Davies',
    referral_source: 'local_authority', status: 'active',
    risk_flags: [],
    keyworker: 'Maria Torres', centre: 'Basingstoke',
    social_worker: 'K. Bridges – Hampshire CC', cafcass_officer: '',
    persons: [
      { id: 'p11', name: 'Lily Davies', dob: '2020-04-10', role: 'child' },
      { id: 'p12', name: 'Hannah Davies', role: 'resident_parent' },
      { id: 'p13', name: 'Tom Davies', role: 'non_resident_parent' },
    ],
    created_at: `${y - 1}-10-01T09:00:00Z`,
  },
];

const SEED_SESSIONS: Session[] = [
  {
    id: 's1', case_id: 'c1', case_ref: SEED_CASES[0].case_ref, family_name: 'Morris',
    session_type: 'supervised',
    scheduled_start: `${today}T09:30:00`, scheduled_end: `${today}T10:30:00`,
    actual_start: `${today}T09:31:00`,
    supervisor: 'Sarah Chen', room: 'Room A', status: 'in_progress',
    attendees: ['David Morris', 'Emily Morris', 'James Morris'],
    notes: [
      { id: 'n1', session_id: 's1', case_id: 'c1', note_type: 'observation', body: 'David arrived calm and on time. Children greeted him warmly. Session started with board game activity — both children engaged positively.', author: 'Sarah Chen', created_at: `${today}T09:35:00Z`, visible_externally: true },
      { id: 'n2', session_id: 's1', case_id: 'c1', note_type: 'welfare_concern', body: 'Emily became visibly distressed when David raised his voice during the board game. Both children retreated to the corner. Session paused 10 minutes. Recommend manager review before next session.', author: 'Sarah Chen', created_at: `${today}T10:14:00Z`, visible_externally: true },
    ],
    created_at: `${today}T09:00:00Z`,
  },
  {
    id: 's2', case_id: 'c2', case_ref: SEED_CASES[1].case_ref, family_name: 'Patel',
    session_type: 'supported',
    scheduled_start: `${today}T11:00:00`, scheduled_end: `${today}T12:00:00`,
    supervisor: 'James Okafor', room: 'Room B', status: 'scheduled',
    attendees: [], notes: [], created_at: `${today}T08:00:00Z`,
  },
  {
    id: 's3', case_id: 'c4', case_ref: SEED_CASES[3].case_ref, family_name: 'Davies',
    session_type: 'supported',
    scheduled_start: `${today}T14:00:00`, scheduled_end: `${today}T15:00:00`,
    supervisor: 'Maria Torres', room: 'Room A', status: 'scheduled',
    attendees: [], notes: [], created_at: `${today}T08:00:00Z`,
  },
  {
    id: 's4', case_id: 'c3', case_ref: SEED_CASES[2].case_ref, family_name: 'Johnson',
    session_type: 'supervised',
    scheduled_start: `${y}-04-28T14:00:00`, scheduled_end: `${y}-04-28T15:00:00`,
    actual_start: `${y}-04-28T14:02:00`, actual_end: `${y}-04-28T15:05:00`,
    supervisor: 'James Okafor', room: 'Room A', status: 'completed',
    attendees: ['Mark Johnson', 'Tyler Johnson'],
    notes: [
      { id: 'n3', session_id: 's4', case_id: 'c3', note_type: 'observation', body: 'Session completed without incident. Tyler was engaged and positive throughout. Mark brought a football which Tyler enjoyed greatly.', author: 'James Okafor', created_at: `${y}-04-28T15:10:00Z`, visible_externally: true },
    ],
    created_at: `${y}-04-28T08:00:00Z`,
  },
];

const SEED_DOCS: Document[] = [
  { id: 'd1', case_id: 'c1', name: 'Court Order WN-2026-FC-00841.pdf', type: 'Court order', uploaded_by: 'Sarah Chen', uploaded_at: `${y}-01-15T10:00:00Z`, size: '1.2 MB' },
  { id: 'd2', case_id: 'c1', name: 'Risk Assessment – Morris Jan 2026.pdf', type: 'Risk assessment', uploaded_by: 'Sarah Chen', uploaded_at: `${y}-01-16T09:00:00Z`, size: '456 KB' },
  { id: 'd3', case_id: 'c3', name: 'Cafcass Section 7 Report.pdf', type: 'Cafcass report', uploaded_by: 'James Okafor', uploaded_at: `${y - 1}-11-21T11:00:00Z`, size: '2.1 MB' },
];

// Mutable state
let _cases = [...SEED_CASES];
let _sessions = [...SEED_SESSIONS];
let _documents = [...SEED_DOCS];
let _counter = 42;

// Phase 2 state
let _shareLinks: ShareLink[] = [
  {
    id: 'sl1', token: 'tok-abc-001',
    case_id: 'c1', case_ref: SEED_CASES[0].case_ref, family_name: 'Morris',
    recipient_name: 'K. Bridges', recipient_email: 'k.bridges@hants.gov.uk',
    recipient_role: 'social_worker',
    scope: { session_ids: ['s1', 's4'], include_notes: 'all', include_documents: true, include_recordings: false },
    purpose: 'Case review meeting 15 May — judge requested full session history',
    expires_at: new Date(Date.now() + 13 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'active', approval_status: 'approved',
    approved_by: 'Director J. Walsh', approved_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    created_by: 'Sarah Chen', created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    view_count: 3,
    audit_log: [
      { id: 'a1', share_link_id: 'sl1', event: 'created', actor: 'Sarah Chen', created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString() },
      { id: 'a2', share_link_id: 'sl1', event: 'approved', actor: 'Director J. Walsh', created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() },
      { id: 'a3', share_link_id: 'sl1', event: 'viewed', actor: 'k.bridges@hants.gov.uk', ip: '82.44.12.190', created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString() },
      { id: 'a4', share_link_id: 'sl1', event: 'viewed', actor: 'k.bridges@hants.gov.uk', ip: '82.44.12.190', created_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString() },
    ],
  },
  {
    id: 'sl2', token: 'tok-abc-002',
    case_id: 'c1', case_ref: SEED_CASES[0].case_ref, family_name: 'Morris',
    recipient_name: 'P. Sutton', recipient_email: 'p.sutton@cafcass.gov.uk',
    recipient_role: 'cafcass',
    scope: { session_ids: ['s1'], include_notes: 'welfare_concern', include_documents: false, include_recordings: false },
    purpose: 'Welfare concern flagged today — Cafcass review required before next session',
    expires_at: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'active', approval_status: 'approved',
    approved_by: 'Director J. Walsh', approved_at: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    created_by: 'Sarah Chen', created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    view_count: 1,
    audit_log: [
      { id: 'a5', share_link_id: 'sl2', event: 'created', actor: 'Sarah Chen', created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() },
      { id: 'a6', share_link_id: 'sl2', event: 'approved', actor: 'Director J. Walsh', created_at: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString() },
    ],
  },
  {
    id: 'sl3', token: 'tok-abc-003',
    case_id: 'c3', case_ref: SEED_CASES[2].case_ref, family_name: 'Johnson',
    recipient_name: 'R. Sharma', recipient_email: 'r.sharma@lesterlaw.co.uk',
    recipient_role: 'solicitor',
    scope: { session_ids: ['s4'], include_notes: 'all', include_documents: true, include_recordings: false },
    purpose: 'Hearing on 20 May — solicitor requested session evidence bundle',
    expires_at: new Date(Date.now() + 17 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'active', approval_status: 'approved',
    approved_by: 'Director J. Walsh', approved_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    created_by: 'James Okafor', created_at: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
    view_count: 5,
    audit_log: [
      { id: 'a7', share_link_id: 'sl3', event: 'created', actor: 'James Okafor', created_at: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString() },
      { id: 'a8', share_link_id: 'sl3', event: 'approved', actor: 'Director J. Walsh', created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString() },
      { id: 'a9', share_link_id: 'sl3', event: 'viewed', actor: 'r.sharma@lesterlaw.co.uk', ip: '91.108.4.22', created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString() },
      { id: 'a10', share_link_id: 'sl3', event: 'document_opened', actor: 'r.sharma@lesterlaw.co.uk', created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), detail: 'Cafcass Section 7 Report.pdf' },
    ],
  },
  {
    id: 'sl4', token: 'tok-abc-004',
    case_id: 'c2', case_ref: SEED_CASES[1].case_ref, family_name: 'Patel',
    recipient_name: 'L. Wade', recipient_email: 'l.wade@hants.gov.uk',
    recipient_role: 'social_worker',
    scope: { session_ids: ['s2'], include_notes: 'all', include_documents: false, include_recordings: false },
    purpose: 'Monthly LA review — session update required',
    expires_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'expired', approval_status: 'approved',
    approved_by: 'Sarah Chen', approved_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    created_by: 'Sarah Chen', created_at: new Date(Date.now() - 11 * 24 * 60 * 60 * 1000).toISOString(),
    view_count: 2,
    audit_log: [
      { id: 'a11', share_link_id: 'sl4', event: 'created', actor: 'Sarah Chen', created_at: new Date(Date.now() - 11 * 24 * 60 * 60 * 1000).toISOString() },
      { id: 'a12', share_link_id: 'sl4', event: 'expired', actor: 'system', created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() },
    ],
  },
  {
    id: 'sl5', token: 'tok-abc-005',
    case_id: 'c4', case_ref: SEED_CASES[3].case_ref, family_name: 'Davies',
    recipient_name: 'T. Elliot', recipient_email: 't.elliot@winchestercourt.gov.uk',
    recipient_role: 'court',
    scope: { session_ids: ['s3'], include_notes: 'all', include_documents: true, include_recordings: false },
    purpose: 'Court bundle for Winchester County Court hearing',
    expires_at: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'pending_approval', approval_status: 'pending',
    created_by: 'Maria Torres', created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    view_count: 0,
    audit_log: [
      { id: 'a13', share_link_id: 'sl5', event: 'created', actor: 'Maria Torres', created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString() },
    ],
  },
];


// Phase 3 state
function inv(n: number): string { return `INV-2026-${String(n).padStart(4,'0')}`; }
const dm = (d: number) => new Date(Date.now() + d * 86400000).toISOString();
const dp = (d: number) => new Date(Date.now() - d * 86400000).toISOString();

let _invoices: Invoice[] = [
  {
    id: 'i1', invoice_number: inv(1), case_id: 'c1', case_ref: SEED_CASES[0].case_ref,
    family_name: 'Morris', client_name: 'Hampshire County Council',
    client_email: 'finance@hants.gov.uk', client_type: 'local_authority',
    lines: [
      { id: 'il1', description: 'Supervised contact session x4 (Apr 2026)', type: 'supervised_session', quantity: 4, unit_price: 95, total: 380 },
      { id: 'il2', description: 'Monthly session report', type: 'report_fee', quantity: 1, unit_price: 45, total: 45 },
    ],
    subtotal: 425, vat: 0, total: 425, status: 'sent',
    payment_method: 'invoice', issued_at: dp(10), due_at: dm(20),
    created_by: 'Sarah Chen', created_at: dp(10),
  },
  {
    id: 'i2', invoice_number: inv(2), case_id: 'c3', case_ref: SEED_CASES[2].case_ref,
    family_name: 'Johnson', client_name: 'Hampshire County Council',
    client_email: 'finance@hants.gov.uk', client_type: 'local_authority',
    lines: [
      { id: 'il3', description: 'Supervised contact session x4 (Apr 2026)', type: 'supervised_session', quantity: 4, unit_price: 95, total: 380 },
      { id: 'il4', description: 'Safeguarding incident report', type: 'report_fee', quantity: 1, unit_price: 65, total: 65 },
    ],
    subtotal: 445, vat: 0, total: 445, status: 'overdue',
    payment_method: 'invoice', issued_at: dp(35), due_at: dp(5),
    created_by: 'James Okafor', created_at: dp(35),
  },
  {
    id: 'i3', invoice_number: inv(3), case_id: 'c2', case_ref: SEED_CASES[1].case_ref,
    family_name: 'Patel', client_name: 'Raj Patel',
    client_email: 'raj.patel@gmail.com', client_type: 'private',
    lines: [
      { id: 'il5', description: 'Supported contact session x3 (Apr 2026)', type: 'supported_session', quantity: 3, unit_price: 75, total: 225 },
    ],
    subtotal: 225, vat: 45, total: 270, status: 'paid',
    payment_method: 'stripe', issued_at: dp(20), due_at: dp(6), paid_at: dp(4),
    stripe_payment_link: 'https://buy.stripe.com/demo',
    created_by: 'James Okafor', created_at: dp(20),
  },
  {
    id: 'i4', invoice_number: inv(4), case_id: 'c4', case_ref: SEED_CASES[3].case_ref,
    family_name: 'Davies', client_name: 'Hampshire County Council',
    client_email: 'finance@hants.gov.uk', client_type: 'local_authority',
    lines: [
      { id: 'il6', description: 'Supported contact session x2 (Apr 2026)', type: 'supported_session', quantity: 2, unit_price: 80, total: 160 },
    ],
    subtotal: 160, vat: 0, total: 160, status: 'paid',
    payment_method: 'bacs', issued_at: dp(28), due_at: dp(14), paid_at: dp(10),
    created_by: 'Maria Torres', created_at: dp(28),
  },
  {
    id: 'i5', invoice_number: inv(5), case_id: 'c1', case_ref: SEED_CASES[0].case_ref,
    family_name: 'Morris', client_name: 'Hampshire County Council',
    client_email: 'finance@hants.gov.uk', client_type: 'local_authority',
    lines: [
      { id: 'il7', description: 'Supervised contact session x4 (May 2026)', type: 'supervised_session', quantity: 4, unit_price: 95, total: 380 },
      { id: 'il8', description: 'Monthly session report', type: 'report_fee', quantity: 1, unit_price: 45, total: 45 },
    ],
    subtotal: 425, vat: 0, total: 425, status: 'draft',
    payment_method: 'invoice', created_by: 'Sarah Chen', created_at: dp(1),
  },
];

let _safeguarding: SafeguardingIncident[] = [
  {
    id: 'sg1', case_id: 'c1', case_ref: SEED_CASES[0].case_ref, family_name: 'Morris',
    session_id: 's1', category: 'emotional_harm',
    description: 'Emily became visibly distressed when David raised his voice during the board game activity. Both children retreated to the corner of the room. Emily was shaking and refused to engage for approximately 10 minutes.',
    immediate_action_taken: 'Session paused. David reminded of conduct guidelines. Children given quiet time with supervisor. Session resumed after 10 minutes when children settled. Both children left safely with resident parent.',
    reported_by: 'Sarah Chen', reported_at: new Date().toISOString(),
    status: 'open', children_involved: ['Emily Morris', 'James Morris'],
    follow_up_actions: ['Manager review before next session', 'Consider reducing session frequency', 'Notify Cafcass officer P. Sutton'],
  },
  {
    id: 'sg2', case_id: 'c3', case_ref: SEED_CASES[2].case_ref, family_name: 'Johnson',
    category: 'parental_behaviour',
    description: 'Mark Johnson attended session with strong smell of alcohol. Tyler appeared uncomfortable and asked to go home early. Session terminated at 14:45.',
    immediate_action_taken: 'Session terminated. Mark requested to leave. Tyler collected by Sophie Johnson. Social worker L. Wade notified same day.',
    reported_by: 'James Okafor', reported_at: dp(7),
    status: 'referred', referral_agency: "Hampshire CC Children's Services",
    referral_ref: 'HCCS-2026-04481', referral_date: dp(6),
    manager_review: 'Incident confirmed serious. Referred to HCCS. Session suspended pending review. Next session not to proceed until written clearance received.',
    manager_reviewed_at: dp(6),
    children_involved: ['Tyler Johnson'],
    follow_up_actions: ['Await HCCS response', 'Do not schedule further sessions until cleared', 'Prepare written account for court'],
  },
];

let _nacccReports: NACCCReport[] = [
  {
    id: 'nr1', case_id: 'c1', case_ref: SEED_CASES[0].case_ref, family_name: 'Morris',
    period_start: dp(30), period_end: dp(1),
    generated_by: 'Sarah Chen', generated_at: dp(1),
    session_count: 4, dna_count: 0, cancelled_count: 0,
    welfare_concerns_count: 1, incidents_count: 1,
    summary: 'Four supervised contact sessions completed in April 2026. Contact between David Morris and both children has been generally positive with the exception of one welfare concern raised on 2 May where David raised his voice causing distress to Emily. This has been logged and reported.',
    recommendations: 'Continue supervised contact at current fortnightly frequency. Recommend structured activity plans are provided to David in advance of each session. Consider referral to parenting support programme.',
    supervisor_sign: 'Sarah Chen', manager_sign: 'Director J. Walsh',
    status: 'signed',
  },
];

let _invoiceCounter = 5;

function uid() { return Math.random().toString(36).slice(2, 10); }

export const store = {
  getCases: () => _cases,
  getSessions: () => _sessions,
  getDocuments: () => _documents,
  getCaseById: (id: string) => _cases.find(c => c.id === id),
  getSessionsByCase: (caseId: string) => _sessions.filter(s => s.case_id === caseId).sort((a, b) => b.scheduled_start.localeCompare(a.scheduled_start)),
  getDocumentsByCase: (caseId: string) => _documents.filter(d => d.case_id === caseId),
  getTodaySessions: () => {
    const t = new Date().toISOString().split('T')[0];
    return _sessions.filter(s => s.scheduled_start.startsWith(t)).sort((a, b) => a.scheduled_start.localeCompare(b.scheduled_start));
  },
  getAllNotes: (caseId: string): Note[] => {
    return _sessions.filter(s => s.case_id === caseId).flatMap(s => s.notes).sort((a, b) => b.created_at.localeCompare(a.created_at));
  },
  getOverdueSessions: () => {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    return _sessions.filter(s => s.status === 'completed' && s.scheduled_start < cutoff && s.notes.length === 0);
  },

  createCase: (data: Partial<Case>): Case => {
    _counter++;
    const c: Case = {
      id: uid(), case_ref: caseRef('BST', new Date().getFullYear(), _counter),
      family_name: data.family_name || '', referral_source: data.referral_source || 'private',
      status: 'intake', risk_flags: data.risk_flags || [],
      keyworker: data.keyworker || '', centre: 'Basingstoke',
      legal_order_ref: data.legal_order_ref, social_worker: data.social_worker,
      cafcass_officer: data.cafcass_officer, persons: data.persons || [],
      created_at: new Date().toISOString(),
    };
    _cases = [c, ..._cases];
    return c;
  },

  createSession: (data: Partial<Session>): Session => {
    const c = _cases.find(c => c.id === data.case_id);
    const s: Session = {
      id: uid(), case_id: data.case_id || '', case_ref: c?.case_ref || '',
      family_name: c?.family_name || '', session_type: data.session_type || 'supervised',
      scheduled_start: data.scheduled_start || '', scheduled_end: data.scheduled_end || '',
      supervisor: data.supervisor || '', room: data.room || '',
      status: 'scheduled', attendees: [], notes: [],
      created_at: new Date().toISOString(),
    };
    _sessions = [s, ..._sessions];
    return s;
  },

  addNote: (caseId: string, sessionId: string | undefined, note: Partial<Note>): Note => {
    const n: Note = {
      id: uid(), session_id: sessionId, case_id: caseId,
      note_type: note.note_type || 'observation', body: note.body || '',
      author: note.author || 'Sarah Chen', created_at: new Date().toISOString(),
      visible_externally: note.visible_externally ?? true,
    };
    if (sessionId) {
      _sessions = _sessions.map(s => s.id === sessionId ? { ...s, notes: [...s.notes, n] } : s);
    }
    return n;
  },

  updateSessionStatus: (sessionId: string, status: SessionStatus) => {
    _sessions = _sessions.map(s => s.id === sessionId ? {
      ...s, status,
      actual_start: status === 'in_progress' && !s.actual_start ? new Date().toISOString() : s.actual_start,
      actual_end: status === 'completed' ? new Date().toISOString() : s.actual_end,
    } : s);
  },

  checkInAttendee: (sessionId: string, name: string) => {
    _sessions = _sessions.map(s => s.id === sessionId && !s.attendees.includes(name)
      ? { ...s, attendees: [...s.attendees, name] } : s);
  },

  addDocument: (doc: Partial<Document>): Document => {
    const d: Document = {
      id: uid(), case_id: doc.case_id || '', name: doc.name || '',
      type: doc.type || 'Document', uploaded_by: doc.uploaded_by || 'Sarah Chen',
      uploaded_at: new Date().toISOString(), size: doc.size || '—',
    };
    _documents = [d, ..._documents];
    return d;
  },

  // ── Phase 2: Share links ───────────────────────────────────────────────────
  getShareLinks: () => _shareLinks,
  getShareLinksByCase: (caseId: string) => _shareLinks.filter(l => l.case_id === caseId),
  getShareLinkById: (id: string) => _shareLinks.find(l => l.id === id),
  getShareLinkByToken: (token: string) => _shareLinks.find(l => l.token === token),
  getPendingApprovals: () => _shareLinks.filter(l => l.approval_status === 'pending'),

  createShareLink: (data: {
    case_id: string; recipient_name: string; recipient_email: string;
    recipient_role: RecipientRole; scope: ShareScope; purpose: string;
    expires_days: number; created_by: string;
  }): ShareLink => {
    const c = _cases.find(x => x.id === data.case_id);
    const token = `tok-${uid()}-${uid()}`;
    const expiresAt = new Date(Date.now() + data.expires_days * 24 * 60 * 60 * 1000).toISOString();
    const now = new Date().toISOString();
    const link: ShareLink = {
      id: uid(), token,
      case_id: data.case_id, case_ref: c?.case_ref || '', family_name: c?.family_name || '',
      recipient_name: data.recipient_name, recipient_email: data.recipient_email,
      recipient_role: data.recipient_role, scope: data.scope, purpose: data.purpose,
      expires_at: expiresAt, status: 'pending_approval', approval_status: 'pending',
      created_by: data.created_by, created_at: now, view_count: 0,
      audit_log: [{ id: uid(), share_link_id: '', event: 'created', actor: data.created_by, created_at: now }],
    };
    link.audit_log[0].share_link_id = link.id;
    _shareLinks = [link, ..._shareLinks];
    return link;
  },

  approveShareLink: (id: string, approver: string) => {
    const now = new Date().toISOString();
    _shareLinks = _shareLinks.map(l => l.id !== id ? l : {
      ...l, status: 'active' as ShareLinkStatus, approval_status: 'approved' as ApprovalStatus,
      approved_by: approver, approved_at: now,
      audit_log: [...l.audit_log, { id: uid(), share_link_id: id, event: 'approved' as const, actor: approver, created_at: now }],
    });
  },

  rejectShareLink: (id: string, approver: string, reason: string) => {
    const now = new Date().toISOString();
    _shareLinks = _shareLinks.map(l => l.id !== id ? l : {
      ...l, status: 'revoked' as ShareLinkStatus, approval_status: 'rejected' as ApprovalStatus,
      rejection_reason: reason,
      audit_log: [...l.audit_log, { id: uid(), share_link_id: id, event: 'rejected' as const, actor: approver, created_at: now, detail: reason }],
    });
  },

  revokeShareLink: (id: string, actor: string) => {
    const now = new Date().toISOString();
    _shareLinks = _shareLinks.map(l => l.id !== id ? l : {
      ...l, status: 'revoked' as ShareLinkStatus,
      audit_log: [...l.audit_log, { id: uid(), share_link_id: id, event: 'revoked' as const, actor, created_at: now }],
    });
  },


  // ── Phase 3: Invoicing ────────────────────────────────────────────────────
  getInvoices: () => _invoices,
  getInvoicesByCase: (caseId: string) => _invoices.filter(i => i.case_id === caseId),
  getInvoiceById: (id: string) => _invoices.find(i => i.id === id),
  getOverdueInvoices: () => _invoices.filter(i => i.status === 'overdue'),

  createInvoice: (data: Partial<Invoice>): Invoice => {
    _invoiceCounter++;
    const sub = (data.lines || []).reduce((a, l) => a + l.total, 0);
    const vat = data.client_type === 'private' ? Math.round(sub * 0.2 * 100) / 100 : 0;
    const inv: Invoice = {
      id: uid(),
      invoice_number: `INV-${new Date().getFullYear()}-${String(_invoiceCounter).padStart(4,'0')}`,
      case_id: data.case_id || '', case_ref: data.case_ref || '', family_name: data.family_name || '',
      client_name: data.client_name || '', client_email: data.client_email || '',
      client_type: data.client_type || 'local_authority',
      lines: data.lines || [], subtotal: sub, vat, total: sub + vat,
      status: 'draft', payment_method: data.payment_method || 'invoice',
      notes: data.notes, created_by: data.created_by || 'Sarah Chen',
      created_at: new Date().toISOString(),
    };
    _invoices = [inv, ..._invoices];
    return inv;
  },

  updateInvoiceStatus: (id: string, status: InvoiceStatus) => {
    const now = new Date().toISOString();
    _invoices = _invoices.map(i => i.id !== id ? i : {
      ...i, status,
      issued_at: status === 'sent' && !i.issued_at ? now : i.issued_at,
      due_at: status === 'sent' && !i.due_at ? new Date(Date.now() + 30 * 86400000).toISOString() : i.due_at,
      paid_at: status === 'paid' ? now : i.paid_at,
    });
  },

  // ── Phase 3: Safeguarding ─────────────────────────────────────────────────
  getSafeguardingIncidents: () => _safeguarding,
  getSafeguardingByCase: (caseId: string) => _safeguarding.filter(s => s.case_id === caseId),
  getOpenIncidents: () => _safeguarding.filter(s => s.status === 'open' || s.status === 'monitoring'),

  createSafeguardingIncident: (data: Partial<SafeguardingIncident>): SafeguardingIncident => {
    const c = _cases.find(x => x.id === data.case_id);
    const inc: SafeguardingIncident = {
      id: uid(), case_id: data.case_id || '', case_ref: c?.case_ref || '',
      family_name: c?.family_name || '', session_id: data.session_id,
      category: data.category || 'other', description: data.description || '',
      immediate_action_taken: data.immediate_action_taken || '',
      reported_by: data.reported_by || 'Sarah Chen',
      reported_at: new Date().toISOString(), status: 'open',
      children_involved: data.children_involved || [],
      follow_up_actions: data.follow_up_actions || [],
    };
    _safeguarding = [inc, ..._safeguarding];
    return inc;
  },

  updateSafeguardingStatus: (id: string, status: SafeguardingStatus, review?: string) => {
    const now = new Date().toISOString();
    _safeguarding = _safeguarding.map(s => s.id !== id ? s : {
      ...s, status,
      manager_review: review || s.manager_review,
      manager_reviewed_at: review ? now : s.manager_reviewed_at,
      closed_at: status === 'closed' ? now : s.closed_at,
    });
  },

  // ── Phase 3: NACCC Reports ────────────────────────────────────────────────
  getNACCCReports: () => _nacccReports,
  getNACCCReportsByCase: (caseId: string) => _nacccReports.filter(r => r.case_id === caseId),

  generateNACCCReport: (caseId: string, periodStart: string, periodEnd: string, generatedBy: string): NACCCReport => {
    const c = _cases.find(x => x.id === caseId);
    const sessions = _sessions.filter(s => s.case_id === caseId && s.scheduled_start >= periodStart && s.scheduled_start <= periodEnd);
    const allNotes = sessions.flatMap(s => s.notes);
    const report: NACCCReport = {
      id: uid(), case_id: caseId, case_ref: c?.case_ref || '', family_name: c?.family_name || '',
      period_start: periodStart, period_end: periodEnd,
      generated_by: generatedBy, generated_at: new Date().toISOString(),
      session_count: sessions.filter(s => s.status === 'completed').length,
      dna_count: sessions.filter(s => s.status === 'dna').length,
      cancelled_count: sessions.filter(s => s.status === 'cancelled').length,
      welfare_concerns_count: allNotes.filter(n => n.note_type === 'welfare_concern').length,
      incidents_count: allNotes.filter(n => n.note_type === 'incident').length,
      summary: '', recommendations: '',
      supervisor_sign: generatedBy, status: 'draft',
    };
    _nacccReports = [report, ..._nacccReports];
    return report;
  },

  updateNACCCReport: (id: string, data: Partial<NACCCReport>) => {
    _nacccReports = _nacccReports.map(r => r.id !== id ? r : { ...r, ...data });
  },

  // ── Phase 3: Revenue analytics ────────────────────────────────────────────
  getRevenueStats: () => {
    const paid = _invoices.filter(i => i.status === 'paid').reduce((a, i) => a + i.total, 0);
    const outstanding = _invoices.filter(i => i.status === 'sent' || i.status === 'overdue').reduce((a, i) => a + i.total, 0);
    const overdue = _invoices.filter(i => i.status === 'overdue').reduce((a, i) => a + i.total, 0);
    const bySource = {
      local_authority: _invoices.filter(i => i.client_type === 'local_authority' && i.status === 'paid').reduce((a, i) => a + i.total, 0),
      private: _invoices.filter(i => i.client_type === 'private' && i.status === 'paid').reduce((a, i) => a + i.total, 0),
      cafcass: _invoices.filter(i => i.client_type === 'cafcass' && i.status === 'paid').reduce((a, i) => a + i.total, 0),
    };
    return { paid, outstanding, overdue, bySource, invoiceCount: _invoices.length };
  },
  logPortalView: (token: string, ip: string) => {
    const now = new Date().toISOString();
    _shareLinks = _shareLinks.map(l => l.token !== token ? l : {
      ...l, view_count: l.view_count + 1,
      audit_log: [...l.audit_log, { id: uid(), share_link_id: l.id, event: 'viewed' as const, actor: l.recipient_email, ip, created_at: now }],
    });
  },
};

// ── Phase 4 types ─────────────────────────────────────────────────────────────

export type WaitingListStatus = 'waiting' | 'active' | 'withdrawn' | 'completed';
export type CommDirection = 'inbound' | 'outbound';
export type CommChannel = 'phone' | 'email' | 'letter' | 'in_person' | 'other';
export type CommParty = 'resident_parent' | 'non_resident_parent' | 'social_worker' | 'cafcass' | 'solicitor' | 'court' | 'other';

export interface WaitingListEntry {
  id: string;
  centre: string;
  family_name: string;
  referral_source: ReferralSource;
  session_type_needed: SessionType | 'any';
  la_name?: string;
  social_worker?: string;
  social_worker_email?: string;
  risk_flags: RiskFlag[];
  notes?: string;
  priority: 1 | 2 | 3 | 4 | 5;
  status: WaitingListStatus;
  referred_at: string;
  activated_at?: string;
  case_id?: string;
  created_by: string;
}

export interface CommunicationLog {
  id: string;
  case_id: string;
  direction: CommDirection;
  channel: CommChannel;
  party: CommParty;
  party_name: string;
  subject?: string;
  summary: string;
  action_required?: string;
  logged_by: string;
  communicated_at: string;
  created_at: string;
}

export interface SessionFeedback {
  id: string;
  session_id: string;
  case_id: string;
  child_presentation?: number;
  interaction_quality?: number;
  nrp_engagement?: number;
  environment_suitability?: number;
  session_summary: string;
  child_welfare_notes?: string;
  concerns_raised?: string;
  recommendations?: string;
  frequency_recommendation?: string;
  completed_by: string;
  completed_at?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  status: 'draft' | 'submitted' | 'reviewed';
  created_at: string;
}

export interface DBSRecord {
  id: string;
  staff_id: string;
  staff_name: string;
  dbs_number: string;
  issue_date: string;
  expiry_date: string;
  update_service: boolean;
  verified_by?: string;
  verified_at?: string;
  days_until_expiry: number;
  status: 'valid' | 'expiring_soon' | 'expired';
}

export interface StaffMember {
  id: string;
  full_name: string;
  role: 'director' | 'manager' | 'supervisor' | 'admin';
  centre: string;
  centre_id: string;
  email?: string;
  active: boolean;
  dbs_expiry?: string;
  created_at: string;
}

// ── Phase 4 seed data ─────────────────────────────────────────────────────────

const dp2 = (d: number) => new Date(Date.now() - d * 86400000).toISOString();
const df = (d: number) => new Date(Date.now() + d * 86400000).toISOString();

let _waitingList: WaitingListEntry[] = [
  { id: 'w1', centre: 'Basingstoke', family_name: 'Fletcher', referral_source: 'local_authority', session_type_needed: 'supervised', la_name: 'Hampshire CC', social_worker: 'R. Patel', social_worker_email: 'r.patel@hants.gov.uk', risk_flags: ['domestic_violence', 'legal_proceedings'], priority: 1, status: 'waiting', referred_at: dp2(14), created_by: 'Sarah Chen', notes: 'Court ordered — urgent. Hearing in 6 weeks.' },
  { id: 'w2', centre: 'Basingstoke', family_name: 'Okonkwo', referral_source: 'cafcass', session_type_needed: 'supported', risk_flags: ['legal_proceedings'], priority: 2, status: 'waiting', referred_at: dp2(21), created_by: 'James Okafor' },
  { id: 'w3', centre: 'Basingstoke', family_name: 'Burke', referral_source: 'private', session_type_needed: 'handover', risk_flags: [], priority: 3, status: 'waiting', referred_at: dp2(7), created_by: 'Maria Torres' },
  { id: 'w4', centre: 'Basingstoke', family_name: 'Singh', referral_source: 'local_authority', session_type_needed: 'supervised', la_name: 'Hampshire CC', risk_flags: ['safeguarding', 'domestic_violence'], priority: 1, status: 'waiting', referred_at: dp2(30), created_by: 'Sarah Chen' },
];

let _commLogs: CommunicationLog[] = [
  { id: 'cl1', case_id: 'c1', direction: 'inbound', channel: 'phone', party: 'social_worker', party_name: 'K. Bridges', subject: 'Session query', summary: 'K. Bridges called to ask about the welfare concern logged on 2 May. Explained situation and confirmed manager review is underway. She will await written update.', action_required: 'Send written update to K. Bridges by Friday', logged_by: 'Sarah Chen', communicated_at: dp2(1), created_at: dp2(1) },
  { id: 'cl2', case_id: 'c1', direction: 'outbound', channel: 'email', party: 'cafcass', party_name: 'P. Sutton', subject: 'Welfare concern notification', summary: 'Emailed P. Sutton with formal notification of welfare concern raised during session on 2 May. Attached session observation notes.', logged_by: 'Sarah Chen', communicated_at: dp2(1), created_at: dp2(1) },
  { id: 'cl3', case_id: 'c3', direction: 'inbound', channel: 'phone', party: 'solicitor', party_name: 'R. Sharma', subject: 'Court bundle request', summary: 'R. Sharma requested session records 10–12 for upcoming hearing on 20 May. Advised to submit formal request via secure share link. Explained the process.', logged_by: 'James Okafor', communicated_at: dp2(3), created_at: dp2(3) },
];

let _sessionFeedback: SessionFeedback[] = [
  { id: 'sf1', session_id: 's4', case_id: 'c3', child_presentation: 4, interaction_quality: 3, nrp_engagement: 3, environment_suitability: 5, session_summary: 'Session proceeded without incident. Tyler was engaged and positive throughout. Mark brought a football — Tyler enjoyed this greatly. Interaction was warm but Mark struggled with boundaries around screen time discussion.', child_welfare_notes: 'Tyler appeared well, clean, appropriately dressed. No visible marks or concerns.', recommendations: 'Provide Mark with structured activity guide for next session.', frequency_recommendation: 'Maintain fortnightly', completed_by: 'James Okafor', completed_at: dp2(5), status: 'submitted', created_at: dp2(5) },
];

let _dbsRecords: DBSRecord[] = [
  { id: 'dbs1', staff_id: 'st1', staff_name: 'Sarah Chen', dbs_number: 'DBS001234567', issue_date: '2023-03-01', expiry_date: df(400), update_service: true, verified_by: 'Director J. Walsh', verified_at: '2023-03-05T10:00:00Z', days_until_expiry: 400, status: 'valid' },
  { id: 'dbs2', staff_id: 'st2', staff_name: 'James Okafor', dbs_number: 'DBS007654321', issue_date: '2023-01-15', expiry_date: df(18), update_service: false, verified_by: 'Director J. Walsh', verified_at: '2023-01-20T09:00:00Z', days_until_expiry: 18, status: 'expiring_soon' },
  { id: 'dbs3', staff_id: 'st3', staff_name: 'Maria Torres', dbs_number: 'DBS009876543', issue_date: '2022-11-01', expiry_date: df(180), update_service: true, verified_by: 'Sarah Chen', verified_at: '2022-11-05T11:00:00Z', days_until_expiry: 180, status: 'valid' },
];

let _staffMembers: StaffMember[] = [
  { id: 'st1', full_name: 'Sarah Chen', role: 'manager', centre: 'Basingstoke', centre_id: 'c_bst', email: 'sarah@safespace.co.uk', active: true, dbs_expiry: df(400), created_at: '2023-01-01T09:00:00Z' },
  { id: 'st2', full_name: 'James Okafor', role: 'supervisor', centre: 'Basingstoke', centre_id: 'c_bst', email: 'james@safespace.co.uk', active: true, dbs_expiry: df(18), created_at: '2023-01-15T09:00:00Z' },
  { id: 'st3', full_name: 'Maria Torres', role: 'supervisor', centre: 'Basingstoke', centre_id: 'c_bst', email: 'maria@safespace.co.uk', active: true, dbs_expiry: df(180), created_at: '2022-11-01T09:00:00Z' },
  { id: 'st4', full_name: 'Director J. Walsh', role: 'director', centre: 'All centres', centre_id: 'all', email: 'director@safespace.co.uk', active: true, dbs_expiry: df(320), created_at: '2022-06-01T09:00:00Z' },
];

// ── Phase 4 store extensions ──────────────────────────────────────────────────

// Extend the existing store object by appending methods
const _phase4 = {
  // Waiting list
  getWaitingList: () => _waitingList.sort((a, b) => a.priority - b.priority || a.referred_at.localeCompare(b.referred_at)),
  addToWaitingList: (entry: Partial<WaitingListEntry>): WaitingListEntry => {
    const e: WaitingListEntry = { id: Math.random().toString(36).slice(2), centre: 'Basingstoke', family_name: entry.family_name || '', referral_source: entry.referral_source || 'private', session_type_needed: entry.session_type_needed || 'any', risk_flags: entry.risk_flags || [], priority: entry.priority || 3, status: 'waiting', referred_at: new Date().toISOString(), created_by: entry.created_by || 'Sarah Chen', la_name: entry.la_name, social_worker: entry.social_worker, social_worker_email: entry.social_worker_email, notes: entry.notes };
    _waitingList = [e, ..._waitingList];
    return e;
  },
  updateWaitingStatus: (id: string, status: WaitingListStatus, caseId?: string) => {
    _waitingList = _waitingList.map(e => e.id !== id ? e : { ...e, status, case_id: caseId, activated_at: status === 'active' ? new Date().toISOString() : e.activated_at });
  },

  // Communication log
  getCommLogs: (caseId: string) => _commLogs.filter(c => c.case_id === caseId).sort((a, b) => b.communicated_at.localeCompare(a.communicated_at)),
  getAllCommLogs: () => _commLogs.sort((a, b) => b.communicated_at.localeCompare(a.communicated_at)),
  addCommLog: (entry: Partial<CommunicationLog>): CommunicationLog => {
    const e: CommunicationLog = { id: Math.random().toString(36).slice(2), case_id: entry.case_id || '', direction: entry.direction || 'outbound', channel: entry.channel || 'phone', party: entry.party || 'other', party_name: entry.party_name || '', subject: entry.subject, summary: entry.summary || '', action_required: entry.action_required, logged_by: entry.logged_by || 'Sarah Chen', communicated_at: entry.communicated_at || new Date().toISOString(), created_at: new Date().toISOString() };
    _commLogs = [e, ..._commLogs];
    return e;
  },

  // Session feedback
  getFeedbackBySession: (sessionId: string) => _sessionFeedback.find(f => f.session_id === sessionId),
  getFeedbackByCase: (caseId: string) => _sessionFeedback.filter(f => f.case_id === caseId),
  saveFeedback: (feedback: Partial<SessionFeedback>): SessionFeedback => {
    const existing = _sessionFeedback.find(f => f.session_id === feedback.session_id);
    if (existing) {
      const updated = { ...existing, ...feedback, created_at: existing.created_at };
      _sessionFeedback = _sessionFeedback.map(f => f.id === existing.id ? updated : f);
      return updated;
    }
    const f: SessionFeedback = { id: Math.random().toString(36).slice(2), session_id: feedback.session_id || '', case_id: feedback.case_id || '', session_summary: feedback.session_summary || '', child_presentation: feedback.child_presentation, interaction_quality: feedback.interaction_quality, nrp_engagement: feedback.nrp_engagement, environment_suitability: feedback.environment_suitability, child_welfare_notes: feedback.child_welfare_notes, concerns_raised: feedback.concerns_raised, recommendations: feedback.recommendations, frequency_recommendation: feedback.frequency_recommendation, completed_by: feedback.completed_by || 'Sarah Chen', completed_at: new Date().toISOString(), status: 'draft', created_at: new Date().toISOString() };
    _sessionFeedback = [f, ..._sessionFeedback];
    return f;
  },
  submitFeedback: (sessionId: string) => {
    _sessionFeedback = _sessionFeedback.map(f => f.session_id !== sessionId ? f : { ...f, status: 'submitted', completed_at: new Date().toISOString() });
  },

  // DBS
  getDBSRecords: () => _dbsRecords,
  getExpiringDBS: (days = 60) => _dbsRecords.filter(d => d.days_until_expiry <= days && d.status !== 'expired'),

  // Staff
  getStaffMembers: () => _staffMembers,
  getStaffById: (id: string) => _staffMembers.find(s => s.id === id),
  createStaff: (data: Partial<StaffMember>): StaffMember => {
    const s: StaffMember = { id: Math.random().toString(36).slice(2), full_name: data.full_name || '', role: data.role || 'supervisor', centre: data.centre || 'Basingstoke', centre_id: data.centre_id || 'c_bst', email: data.email, active: true, created_at: new Date().toISOString() };
    _staffMembers = [..._staffMembers, s];
    return s;
  },
  updateStaffRole: (id: string, role: StaffMember['role']) => {
    _staffMembers = _staffMembers.map(s => s.id !== id ? s : { ...s, role });
  },
  deactivateStaff: (id: string) => {
    _staffMembers = _staffMembers.map(s => s.id !== id ? s : { ...s, active: false });
  },
};

// Merge phase 4 into store
Object.assign(store, _phase4);

// Type-extended store — exposes Phase 4 methods with correct types
export const storeExt = store as typeof store & typeof _phase4;


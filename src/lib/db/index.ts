/**
 * db/index.ts — Production data layer
 *
 * This is a drop-in replacement for the in-memory store.ts.
 * Every function mirrors the store interface exactly so components
 * need zero changes. Just swap the import:
 *
 *   import { store } from '@/lib/store';
 *   →  import { store } from '@/lib/db';
 */

import { supabase, supabaseAdmin } from './client';
import type {
  Case, Session, Note, Document,
  ShareLink, Invoice, InvoiceLine,
  SafeguardingIncident, NACCCReport,
  ReferralSource, RiskFlag, SessionType, SessionStatus,
  NoteType, RecipientRole, ShareScope, InvoiceStatus,
  SafeguardingCategory, SafeguardingStatus,
} from '../store';

// ── Helpers ───────────────────────────────────────────────────────────────────

function handle<T>(data: T | null, error: unknown): T {
  if (error) { console.error('[db]', error); throw error; }
  return data as T;
}

// Map Supabase row → Case shape
function rowToCase(row: Record<string, unknown>): Case {
  return {
    id: row.id as string,
    case_ref: row.case_ref as string,
    family_name: row.family_name as string,
    referral_source: row.referral_source as ReferralSource,
    status: row.status as Case['status'],
    risk_flags: (row.risk_flags as RiskFlag[]) || [],
    keyworker: (row.keyworker as { full_name: string } | null)?.full_name || '',
    centre: (row.centre as { name: string } | null)?.name || '',
    legal_order_ref: row.legal_order_ref as string | undefined,
    social_worker: row.social_worker as string | undefined,
    cafcass_officer: row.cafcass_officer as string | undefined,
    persons: ((row.persons as Record<string, unknown>[]) || []).map(p => ({
      id: p.id as string,
      name: p.full_name as string,
      dob: p.dob as string | undefined,
      role: p.role as 'child' | 'resident_parent' | 'non_resident_parent',
    })),
    created_at: row.created_at as string,
  };
}

function rowToSession(row: Record<string, unknown>, notes: Note[] = []): Session {
  return {
    id: row.id as string,
    case_id: row.case_id as string,
    case_ref: (row.case as { case_ref: string } | null)?.case_ref || '',
    family_name: (row.case as { family_name: string } | null)?.family_name || '',
    session_type: row.session_type as SessionType,
    scheduled_start: row.scheduled_start as string,
    scheduled_end: row.scheduled_end as string,
    actual_start: row.actual_start as string | undefined,
    actual_end: row.actual_end as string | undefined,
    supervisor: (row.supervisor as { full_name: string } | null)?.full_name || '',
    room: row.room as string,
    status: row.status as SessionStatus,
    attendees: ((row.session_attendees as Record<string, unknown>[]) || [])
      .map((a: Record<string, unknown>) => (a.person as { full_name: string } | null)?.full_name || ''),
    notes,
    created_at: row.created_at as string,
  };
}

function rowToNote(row: Record<string, unknown>): Note {
  return {
    id: row.id as string,
    session_id: row.session_id as string | undefined,
    case_id: row.case_id as string,
    note_type: row.note_type as NoteType,
    body: row.body as string,
    author: (row.author as { full_name: string } | null)?.full_name || 'Unknown',
    created_at: row.created_at as string,
    visible_externally: row.visible_externally as boolean,
  };
}

function rowToInvoice(row: Record<string, unknown>): Invoice {
  return {
    id: row.id as string,
    invoice_number: row.invoice_number as string,
    case_id: row.case_id as string,
    case_ref: (row.case as { case_ref: string } | null)?.case_ref || '',
    family_name: (row.case as { family_name: string } | null)?.family_name || '',
    client_name: row.client_name as string,
    client_email: row.client_email as string,
    client_type: row.client_type as 'local_authority' | 'private' | 'cafcass',
    lines: ((row.invoice_lines as Record<string, unknown>[]) || []).map(l => ({
      id: l.id as string,
      description: l.description as string,
      type: l.line_type as InvoiceLine['type'],
      quantity: Number(l.quantity),
      unit_price: Number(l.unit_price),
      total: Number(l.total),
      session_id: l.session_id as string | undefined,
    })),
    subtotal: Number(row.subtotal),
    vat: Number(row.vat),
    total: Number(row.total),
    status: row.status as InvoiceStatus,
    payment_method: row.payment_method as Invoice['payment_method'],
    issued_at: row.issued_at as string | undefined,
    due_at: row.due_at as string | undefined,
    paid_at: row.paid_at as string | undefined,
    stripe_payment_link: row.stripe_payment_link as string | undefined,
    notes: row.notes as string | undefined,
    created_by: (row.created_by_staff as { full_name: string } | null)?.full_name || '',
    created_at: row.created_at as string,
  };
}

// ── Case queries ──────────────────────────────────────────────────────────────

const CASE_SELECT = `
  *, 
  keyworker:keyworker_id(full_name),
  centre:centre_id(name),
  persons(id, full_name, dob, role)
`;

async function getCases(): Promise<Case[]> {
  const { data, error } = await supabase
    .from('cases').select(CASE_SELECT).order('created_at', { ascending: false });
  return handle(data, error)!.map(rowToCase);
}

async function getCaseById(id: string): Promise<Case | undefined> {
  const { data, error } = await supabase
    .from('cases').select(CASE_SELECT).eq('id', id).single();
  if (error) return undefined;
  return rowToCase(data);
}

async function createCase(input: Partial<Case>): Promise<Case> {
  // Generate case ref via DB function
  const { data: refData } = await supabase
    .rpc('generate_case_ref', { centre_code: process.env.NEXT_PUBLIC_CENTRE_CODE || 'BST' });

  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;

  const { data, error } = await supabase.from('cases').insert({
    case_ref: refData,
    family_name: input.family_name,
    referral_source: input.referral_source,
    status: 'intake',
    risk_flags: input.risk_flags || [],
    legal_order_ref: input.legal_order_ref,
    social_worker: input.social_worker,
    cafcass_officer: input.cafcass_officer,
    created_by: userId,
  }).select(CASE_SELECT).single();

  const newCase = handle(data, error)!;

  // Insert persons
  if (input.persons?.length) {
    await supabase.from('persons').insert(
      input.persons.map(p => ({
        case_id: newCase.id,
        full_name: p.name,
        dob: p.dob,
        role: p.role,
      }))
    );
  }

  return rowToCase(newCase);
}

// ── Session queries ───────────────────────────────────────────────────────────

const SESSION_SELECT = `
  *,
  case:case_id(case_ref, family_name),
  supervisor:supervisor_id(full_name),
  session_attendees(person:person_id(full_name), arrived_at)
`;

async function getSessions(): Promise<Session[]> {
  const { data, error } = await supabase
    .from('sessions').select(SESSION_SELECT).order('scheduled_start', { ascending: false });
  const rows = handle(data, error)!;
  const sessions = await Promise.all(rows.map(async (row: Record<string, unknown>) => {
    const notes = await getNotesBySession(row.id as string);
    return rowToSession(row, notes);
  }));
  return sessions;
}

async function getSessionsByCase(caseId: string): Promise<Session[]> {
  const { data, error } = await supabase
    .from('sessions').select(SESSION_SELECT)
    .eq('case_id', caseId).order('scheduled_start', { ascending: false });
  const rows = handle(data, error)!;
  return Promise.all(rows.map(async (row: Record<string, unknown>) => {
    const notes = await getNotesBySession(row.id as string);
    return rowToSession(row, notes);
  }));
}

async function getTodaySessions(): Promise<Session[]> {
  const today = new Date().toISOString().split('T')[0];
  const { data, error } = await supabase
    .from('sessions').select(SESSION_SELECT)
    .gte('scheduled_start', `${today}T00:00:00`)
    .lte('scheduled_start', `${today}T23:59:59`)
    .order('scheduled_start');
  const rows = handle(data, error)!;
  return Promise.all(rows.map(async (row: Record<string, unknown>) => {
    const notes = await getNotesBySession(row.id as string);
    return rowToSession(row, notes);
  }));
}

async function createSession(input: Partial<Session>): Promise<Session> {
  const { data: userData } = await supabase.auth.getUser();
  const { data, error } = await supabase.from('sessions').insert({
    case_id: input.case_id,
    session_type: input.session_type,
    scheduled_start: input.scheduled_start,
    scheduled_end: input.scheduled_end,
    room: input.room,
    created_by: userData.user?.id,
  }).select(SESSION_SELECT).single();
  return rowToSession(handle(data, error)!, []);
}

async function updateSessionStatus(sessionId: string, status: SessionStatus): Promise<void> {
  const updates: Record<string, unknown> = { status };
  if (status === 'in_progress') updates.actual_start = new Date().toISOString();
  if (status === 'completed') updates.actual_end = new Date().toISOString();
  const { error } = await supabase.from('sessions').update(updates).eq('id', sessionId);
  if (error) throw error;
}

async function checkInAttendee(sessionId: string, personName: string): Promise<void> {
  // Look up person_id by name within the session's case
  const { data: session } = await supabase.from('sessions').select('case_id').eq('id', sessionId).single();
  if (!session) return;
  const { data: person } = await supabase.from('persons')
    .select('id').eq('case_id', session.case_id).eq('full_name', personName).single();
  if (!person) return;
  await supabase.from('session_attendees').upsert({
    session_id: sessionId,
    person_id: person.id,
    arrived_at: new Date().toISOString(),
  });
}

// ── Note queries ──────────────────────────────────────────────────────────────

const NOTE_SELECT = `*, author:author_id(full_name)`;

async function getNotesBySession(sessionId: string): Promise<Note[]> {
  const { data, error } = await supabase
    .from('notes').select(NOTE_SELECT).eq('session_id', sessionId).order('created_at');
  return handle(data, error)!.map(rowToNote);
}

async function getAllNotes(caseId: string): Promise<Note[]> {
  const { data, error } = await supabase
    .from('notes').select(NOTE_SELECT).eq('case_id', caseId).order('created_at', { ascending: false });
  return handle(data, error)!.map(rowToNote);
}

async function addNote(
  caseId: string,
  sessionId: string | undefined,
  note: Partial<Note>
): Promise<Note> {
  const { data: userData } = await supabase.auth.getUser();
  const { data, error } = await supabase.from('notes').insert({
    case_id: caseId,
    session_id: sessionId,
    note_type: note.note_type,
    body: note.body,
    author_id: userData.user?.id,
    visible_externally: note.visible_externally ?? true,
  }).select(NOTE_SELECT).single();
  return rowToNote(handle(data, error)!);
}

// ── Document queries ──────────────────────────────────────────────────────────

async function getDocumentsByCase(caseId: string): Promise<Document[]> {
  const { data, error } = await supabase
    .from('documents').select('*, uploader:uploaded_by(full_name)')
    .eq('case_id', caseId).order('uploaded_at', { ascending: false });
  return handle(data, error)!.map((row: Record<string, unknown>) => ({
    id: row.id as string,
    case_id: row.case_id as string,
    name: row.name as string,
    type: row.type as string,
    uploaded_by: (row.uploader as { full_name: string } | null)?.full_name || '',
    uploaded_at: row.uploaded_at as string,
    size: row.size_bytes ? `${Math.round(Number(row.size_bytes) / 1024)} KB` : '—',
  }));
}

async function uploadDocument(
  caseId: string,
  file: File,
  docType: string
): Promise<Document> {
  const { data: userData } = await supabase.auth.getUser();
  const path = `${caseId}/${Date.now()}-${file.name}`;

  // Upload to Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from('documents').upload(path, file, { contentType: file.type });
  if (uploadError) throw uploadError;

  // Save metadata
  const { data, error } = await supabase.from('documents').insert({
    case_id: caseId,
    name: file.name,
    type: docType,
    storage_path: path,
    size_bytes: file.size,
    uploaded_by: userData.user?.id,
  }).select('*, uploader:uploaded_by(full_name)').single();

  const row = handle(data, error)! as Record<string, unknown>;
  return {
    id: row.id as string,
    case_id: row.case_id as string,
    name: row.name as string,
    type: row.type as string,
    uploaded_by: (row.uploader as { full_name: string } | null)?.full_name || '',
    uploaded_at: row.uploaded_at as string,
    size: `${Math.round(file.size / 1024)} KB`,
  };
}

async function getDocumentSignedUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from('documents').createSignedUrl(storagePath, 900); // 15 min expiry
  return handle(data, error)!.signedUrl;
}

// ── Share link queries ────────────────────────────────────────────────────────

const SHARE_SELECT = `
  *,
  created_by_staff:created_by(full_name),
  approver:approved_by(full_name),
  audit_log:share_audit_log(*)
`;

function rowToShareLink(row: Record<string, unknown>): ShareLink {
  return {
    id: row.id as string,
    token: row.token as string,
    case_id: row.case_id as string,
    case_ref: '',  // populated by join if needed
    family_name: '',
    recipient_name: row.recipient_name as string,
    recipient_email: row.recipient_email as string,
    recipient_role: row.recipient_role as RecipientRole,
    scope: {
      session_ids: (row.session_ids as string[]) || [],
      include_notes: row.include_notes as ShareScope['include_notes'],
      include_documents: row.include_documents as boolean,
      include_recordings: row.include_recordings as boolean,
    },
    purpose: row.purpose as string,
    expires_at: row.expires_at as string,
    status: row.status as ShareLink['status'],
    approval_status: row.approval_status as ShareLink['approval_status'],
    approved_by: (row.approver as { full_name: string } | null)?.full_name,
    approved_at: row.approved_at as string | undefined,
    rejection_reason: row.rejection_reason as string | undefined,
    created_by: (row.created_by_staff as { full_name: string } | null)?.full_name || '',
    created_at: row.created_at as string,
    view_count: row.view_count as number,
    audit_log: ((row.audit_log as Record<string, unknown>[]) || []).map(a => ({
      id: a.id as string,
      share_link_id: a.share_link_id as string,
      event: a.event as ShareLink['audit_log'][0]['event'],
      actor: a.actor as string,
      ip: a.ip_address as string | undefined,
      created_at: a.created_at as string,
      detail: a.detail as string | undefined,
    })),
  };
}

async function getShareLinks(): Promise<ShareLink[]> {
  const { data, error } = await supabase
    .from('share_links').select(SHARE_SELECT).order('created_at', { ascending: false });
  return handle(data, error)!.map(rowToShareLink);
}

async function getShareLinksByCase(caseId: string): Promise<ShareLink[]> {
  const { data, error } = await supabase
    .from('share_links').select(SHARE_SELECT).eq('case_id', caseId).order('created_at', { ascending: false });
  return handle(data, error)!.map(rowToShareLink);
}

async function getShareLinkByToken(token: string): Promise<ShareLink | undefined> {
  const { data, error } = await supabase
    .from('share_links').select(SHARE_SELECT).eq('token', token).single();
  if (error) return undefined;
  return rowToShareLink(data as Record<string, unknown>);
}

async function getPendingApprovals(): Promise<ShareLink[]> {
  const { data, error } = await supabase
    .from('share_links').select(SHARE_SELECT).eq('approval_status', 'pending');
  return handle(data, error)!.map(rowToShareLink);
}

async function createShareLink(input: {
  case_id: string; recipient_name: string; recipient_email: string;
  recipient_role: RecipientRole; scope: ShareScope; purpose: string;
  expires_days: number; created_by: string;
}): Promise<ShareLink> {
  const { data: userData } = await supabase.auth.getUser();
  const expiresAt = new Date(Date.now() + input.expires_days * 86400000).toISOString();

  const { data, error } = await supabase.from('share_links').insert({
    case_id: input.case_id,
    recipient_name: input.recipient_name,
    recipient_email: input.recipient_email,
    recipient_role: input.recipient_role,
    session_ids: input.scope.session_ids,
    include_notes: input.scope.include_notes,
    include_documents: input.scope.include_documents,
    include_recordings: input.scope.include_recordings,
    purpose: input.purpose,
    expires_at: expiresAt,
    created_by: userData.user?.id,
  }).select(SHARE_SELECT).single();

  const link = rowToShareLink(handle(data, error)! as Record<string, unknown>);

  // Log creation
  await supabase.from('share_audit_log').insert({
    share_link_id: link.id,
    event: 'created',
    actor: input.created_by,
  });

  return link;
}

async function approveShareLink(id: string, approver: string): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const now = new Date().toISOString();
  await supabase.from('share_links').update({
    status: 'active',
    approval_status: 'approved',
    approved_by: userData.user?.id,
    approved_at: now,
  }).eq('id', id);
  await supabase.from('share_audit_log').insert({ share_link_id: id, event: 'approved', actor: approver });
}

async function rejectShareLink(id: string, approver: string, reason: string): Promise<void> {
  await supabase.from('share_links').update({
    status: 'revoked', approval_status: 'rejected', rejection_reason: reason,
  }).eq('id', id);
  await supabase.from('share_audit_log').insert({ share_link_id: id, event: 'rejected', actor: approver, detail: reason });
}

async function revokeShareLink(id: string, actor: string): Promise<void> {
  await supabase.from('share_links').update({ status: 'revoked' }).eq('id', id);
  await supabase.from('share_audit_log').insert({ share_link_id: id, event: 'revoked', actor });
}

async function logPortalView(token: string, ip: string): Promise<void> {
  const { data: link } = await supabase.from('share_links').select('id, recipient_email, view_count').eq('token', token).single();
  if (!link) return;
  await supabase.from('share_links').update({ view_count: (link.view_count || 0) + 1 }).eq('id', link.id);
  await supabase.from('share_audit_log').insert({ share_link_id: link.id, event: 'viewed', actor: link.recipient_email, ip_address: ip });
}

// ── Invoice queries ───────────────────────────────────────────────────────────

const INVOICE_SELECT = `*, case:case_id(case_ref, family_name), invoice_lines(*), created_by_staff:created_by(full_name)`;

async function getInvoices(): Promise<Invoice[]> {
  const { data, error } = await supabase.from('invoices').select(INVOICE_SELECT).order('created_at', { ascending: false });
  return handle(data, error)!.map(rowToInvoice);
}

async function getInvoicesByCase(caseId: string): Promise<Invoice[]> {
  const { data, error } = await supabase.from('invoices').select(INVOICE_SELECT).eq('case_id', caseId).order('created_at', { ascending: false });
  return handle(data, error)!.map(rowToInvoice);
}

async function getInvoiceById(id: string): Promise<Invoice | undefined> {
  const { data, error } = await supabase.from('invoices').select(INVOICE_SELECT).eq('id', id).single();
  if (error) return undefined;
  return rowToInvoice(data as Record<string, unknown>);
}

async function getOverdueInvoices(): Promise<Invoice[]> {
  const { data, error } = await supabase.from('invoices').select(INVOICE_SELECT).eq('status', 'overdue');
  return handle(data, error)!.map(rowToInvoice);
}

async function createInvoice(input: Partial<Invoice>): Promise<Invoice> {
  const { data: userData } = await supabase.auth.getUser();
  const { data: numData } = await supabase.rpc('generate_invoice_number');

  const { data, error } = await supabase.from('invoices').insert({
    invoice_number: numData,
    case_id: input.case_id,
    client_name: input.client_name,
    client_email: input.client_email,
    client_type: input.client_type,
    subtotal: input.subtotal,
    vat: input.vat,
    total: input.total,
    payment_method: input.payment_method,
    notes: input.notes,
    created_by: userData.user?.id,
  }).select('id').single();

  const inv = handle(data, error)!;

  // Insert lines
  if (input.lines?.length) {
    await supabase.from('invoice_lines').insert(
      input.lines.map((l, i) => ({
        invoice_id: inv.id,
        description: l.description,
        line_type: l.type,
        quantity: l.quantity,
        unit_price: l.unit_price,
        total: l.total,
        session_id: l.session_id,
        sort_order: i,
      }))
    );
  }

  return (await getInvoiceById(inv.id))!;
}

async function updateInvoiceStatus(id: string, status: InvoiceStatus): Promise<void> {
  const updates: Record<string, unknown> = { status };
  if (status === 'sent') { updates.issued_at = new Date().toISOString(); updates.due_at = new Date(Date.now() + 30 * 86400000).toISOString(); }
  if (status === 'paid') updates.paid_at = new Date().toISOString();
  await supabase.from('invoices').update(updates).eq('id', id);
}

async function getRevenueStats() {
  const { data, error } = await supabase.from('invoices').select('status, total, client_type');
  const invs = handle(data, error)!;
  const paid = invs.filter((i: Record<string,unknown>) => i.status === 'paid').reduce((a: number, i: Record<string,unknown>) => a + Number(i.total), 0);
  const outstanding = invs.filter((i: Record<string,unknown>) => ['sent','overdue'].includes(i.status as string)).reduce((a: number, i: Record<string,unknown>) => a + Number(i.total), 0);
  const overdue = invs.filter((i: Record<string,unknown>) => i.status === 'overdue').reduce((a: number, i: Record<string,unknown>) => a + Number(i.total), 0);
  const bySource = {
    local_authority: invs.filter((i: Record<string,unknown>) => i.client_type === 'local_authority' && i.status === 'paid').reduce((a: number, i: Record<string,unknown>) => a + Number(i.total), 0),
    private: invs.filter((i: Record<string,unknown>) => i.client_type === 'private' && i.status === 'paid').reduce((a: number, i: Record<string,unknown>) => a + Number(i.total), 0),
    cafcass: invs.filter((i: Record<string,unknown>) => i.client_type === 'cafcass' && i.status === 'paid').reduce((a: number, i: Record<string,unknown>) => a + Number(i.total), 0),
  };
  return { paid, outstanding, overdue, bySource, invoiceCount: invs.length };
}

// ── Safeguarding queries ──────────────────────────────────────────────────────

async function getSafeguardingIncidents(): Promise<SafeguardingIncident[]> {
  const { data, error } = await supabase.from('safeguarding_incidents').select('*, reporter:reported_by(full_name), case:case_id(case_ref, family_name)').order('reported_at', { ascending: false });
  return handle(data, error)!.map((row: Record<string,unknown>) => ({
    id: row.id as string, case_id: row.case_id as string,
    case_ref: (row.case as {case_ref:string}|null)?.case_ref||'',
    family_name: (row.case as {family_name:string}|null)?.family_name||'',
    session_id: row.session_id as string|undefined,
    category: row.category as SafeguardingCategory,
    description: row.description as string,
    immediate_action_taken: row.immediate_action_taken as string,
    reported_by: (row.reporter as {full_name:string}|null)?.full_name||'',
    reported_at: row.reported_at as string,
    status: row.status as SafeguardingStatus,
    referral_agency: row.referral_agency as string|undefined,
    referral_ref: row.referral_ref as string|undefined,
    referral_date: row.referral_date as string|undefined,
    manager_review: row.manager_review as string|undefined,
    manager_reviewed_at: row.manager_reviewed_at as string|undefined,
    outcome: row.outcome as string|undefined,
    closed_at: row.closed_at as string|undefined,
    children_involved: (row.children_involved as string[])||[],
    follow_up_actions: (row.follow_up_actions as string[])||[],
  }));
}

async function getSafeguardingByCase(caseId: string): Promise<SafeguardingIncident[]> {
  const { data, error } = await supabase.from('safeguarding_incidents').select('*, reporter:reported_by(full_name), case:case_id(case_ref, family_name)').eq('case_id', caseId).order('reported_at', { ascending: false });
  return handle(data, error)!.map((row: Record<string,unknown>) => ({
    id: row.id as string, case_id: row.case_id as string,
    case_ref: (row.case as {case_ref:string}|null)?.case_ref||'',
    family_name: (row.case as {family_name:string}|null)?.family_name||'',
    session_id: row.session_id as string|undefined,
    category: row.category as SafeguardingCategory,
    description: row.description as string,
    immediate_action_taken: row.immediate_action_taken as string,
    reported_by: (row.reporter as {full_name:string}|null)?.full_name||'',
    reported_at: row.reported_at as string,
    status: row.status as SafeguardingStatus,
    referral_agency: row.referral_agency as string|undefined,
    referral_ref: row.referral_ref as string|undefined,
    referral_date: row.referral_date as string|undefined,
    manager_review: row.manager_review as string|undefined,
    manager_reviewed_at: row.manager_reviewed_at as string|undefined,
    outcome: row.outcome as string|undefined,
    closed_at: row.closed_at as string|undefined,
    children_involved: (row.children_involved as string[])||[],
    follow_up_actions: (row.follow_up_actions as string[])||[],
  }));
}

async function getOpenIncidents(): Promise<SafeguardingIncident[]> {
  const { data, error } = await supabase.from('safeguarding_incidents').select('*, reporter:reported_by(full_name), case:case_id(case_ref, family_name)').in('status', ['open','monitoring']);
  return handle(data, error)!.map((row: Record<string,unknown>) => ({
    id: row.id as string, case_id: row.case_id as string,
    case_ref: (row.case as {case_ref:string}|null)?.case_ref||'',
    family_name: (row.case as {family_name:string}|null)?.family_name||'',
    session_id: row.session_id as string|undefined,
    category: row.category as SafeguardingCategory,
    description: row.description as string,
    immediate_action_taken: row.immediate_action_taken as string,
    reported_by: (row.reporter as {full_name:string}|null)?.full_name||'',
    reported_at: row.reported_at as string,
    status: row.status as SafeguardingStatus,
    referral_agency: row.referral_agency as string|undefined,
    referral_ref: row.referral_ref as string|undefined,
    referral_date: row.referral_date as string|undefined,
    manager_review: row.manager_review as string|undefined,
    manager_reviewed_at: row.manager_reviewed_at as string|undefined,
    children_involved: (row.children_involved as string[])||[],
    follow_up_actions: (row.follow_up_actions as string[])||[],
  }));
}

async function createSafeguardingIncident(input: Partial<SafeguardingIncident>): Promise<SafeguardingIncident> {
  const { data: userData } = await supabase.auth.getUser();
  const { data, error } = await supabase.from('safeguarding_incidents').insert({
    case_id: input.case_id, session_id: input.session_id,
    category: input.category, description: input.description,
    immediate_action_taken: input.immediate_action_taken,
    reported_by: userData.user?.id,
    children_involved: input.children_involved || [],
    follow_up_actions: input.follow_up_actions || [],
  }).select('id').single();
  const inc = handle(data, error)!;
  return (await getSafeguardingByCase(input.case_id!))[0];
}

async function updateSafeguardingStatus(id: string, status: SafeguardingStatus, review?: string): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const updates: Record<string, unknown> = { status };
  if (review) { updates.manager_review = review; updates.manager_reviewed_by = userData.user?.id; updates.manager_reviewed_at = new Date().toISOString(); }
  if (status === 'closed') updates.closed_at = new Date().toISOString();
  await supabase.from('safeguarding_incidents').update(updates).eq('id', id);
}

// ── NACCC report queries ───────────────────────────────────────────────────────

async function getNACCCReports(): Promise<NACCCReport[]> {
  const { data, error } = await supabase.from('naccc_reports').select('*, case:case_id(case_ref, family_name), generator:generated_by(full_name)').order('generated_at', { ascending: false });
  return handle(data, error)!.map((row: Record<string,unknown>) => ({
    id: row.id as string, case_id: row.case_id as string,
    case_ref: (row.case as {case_ref:string}|null)?.case_ref||'',
    family_name: (row.case as {family_name:string}|null)?.family_name||'',
    period_start: row.period_start as string, period_end: row.period_end as string,
    generated_by: (row.generator as {full_name:string}|null)?.full_name||'',
    generated_at: row.generated_at as string,
    session_count: row.session_count as number, dna_count: row.dna_count as number,
    cancelled_count: row.cancelled_count as number,
    welfare_concerns_count: row.welfare_concerns_count as number,
    incidents_count: row.incidents_count as number,
    summary: row.summary as string, recommendations: row.recommendations as string,
    supervisor_sign: row.supervisor_sign as string,
    manager_sign: row.manager_sign as string|undefined,
    status: row.status as NACCCReport['status'],
  }));
}

async function getNACCCReportsByCase(caseId: string): Promise<NACCCReport[]> {
  const { data, error } = await supabase.from('naccc_reports').select('*, case:case_id(case_ref, family_name), generator:generated_by(full_name)').eq('case_id', caseId).order('generated_at', { ascending: false });
  return handle(data, error)!.map((row: Record<string,unknown>) => ({
    id: row.id as string, case_id: row.case_id as string,
    case_ref: (row.case as {case_ref:string}|null)?.case_ref||'',
    family_name: (row.case as {family_name:string}|null)?.family_name||'',
    period_start: row.period_start as string, period_end: row.period_end as string,
    generated_by: (row.generator as {full_name:string}|null)?.full_name||'',
    generated_at: row.generated_at as string,
    session_count: row.session_count as number, dna_count: row.dna_count as number,
    cancelled_count: row.cancelled_count as number,
    welfare_concerns_count: row.welfare_concerns_count as number,
    incidents_count: row.incidents_count as number,
    summary: row.summary as string, recommendations: row.recommendations as string,
    supervisor_sign: row.supervisor_sign as string,
    manager_sign: row.manager_sign as string|undefined,
    status: row.status as NACCCReport['status'],
  }));
}

async function generateNACCCReport(caseId: string, periodStart: string, periodEnd: string, generatedBy: string): Promise<NACCCReport> {
  const { data: userData } = await supabase.auth.getUser();

  // Pull session stats for the period
  const { data: sessions } = await supabase.from('sessions').select('id, status').eq('case_id', caseId).gte('scheduled_start', periodStart).lte('scheduled_start', periodEnd);
  const sessionIds = (sessions || []).map((s: Record<string,unknown>) => s.id);

  const { data: notes } = sessionIds.length
    ? await supabase.from('notes').select('note_type').in('session_id', sessionIds)
    : { data: [] };

  const completed = (sessions || []).filter((s: Record<string,unknown>) => s.status === 'completed').length;
  const dna = (sessions || []).filter((s: Record<string,unknown>) => s.status === 'dna').length;
  const cancelled = (sessions || []).filter((s: Record<string,unknown>) => s.status === 'cancelled').length;
  const welfare = (notes || []).filter((n: Record<string,unknown>) => n.note_type === 'welfare_concern').length;
  const incidents = (notes || []).filter((n: Record<string,unknown>) => n.note_type === 'incident').length;

  const { data, error } = await supabase.from('naccc_reports').insert({
    case_id: caseId, period_start: periodStart, period_end: periodEnd,
    session_count: completed, dna_count: dna, cancelled_count: cancelled,
    welfare_concerns_count: welfare, incidents_count: incidents,
    generated_by: userData.user?.id,
    supervisor_sign: generatedBy,
  }).select('id').single();

  const rep = handle(data, error)!;
  return (await getNACCCReportsByCase(caseId))[0];
}

async function updateNACCCReport(id: string, data: Partial<NACCCReport>): Promise<void> {
  const updates: Record<string, unknown> = {};
  if (data.summary !== undefined) updates.summary = data.summary;
  if (data.recommendations !== undefined) updates.recommendations = data.recommendations;
  if (data.status !== undefined) updates.status = data.status;
  if (data.manager_sign !== undefined) { updates.manager_sign = data.manager_sign; updates.manager_signed_at = new Date().toISOString(); }
  if (data.status === 'submitted') updates.submitted_at = new Date().toISOString();
  await supabase.from('naccc_reports').update(updates).eq('id', id);
}

// ── Exported store object (same interface as in-memory store.ts) ──────────────

export const store = {
  // Cases
  getCases, getCaseById, createCase,
  getSessionsByCase,

  // Sessions
  getSessions, getTodaySessions, createSession,
  updateSessionStatus, checkInAttendee,

  // Notes
  getAllNotes, addNote,

  // Documents
  getDocuments: () => Promise.resolve([] as Document[]),
  getDocumentsByCase, uploadDocument, getDocumentSignedUrl,
  addDocument: (doc: Partial<Document>) => Promise.resolve(doc as Document),

  // Share links
  getShareLinks, getShareLinksByCase,
  getShareLinkByToken,
  getShareLinkById: async (id: string) => (await getShareLinks()).find(l => l.id === id),
  getPendingApprovals, createShareLink,
  approveShareLink, rejectShareLink, revokeShareLink, logPortalView,

  // Invoices
  getInvoices, getInvoicesByCase, getInvoiceById,
  getOverdueInvoices, createInvoice,
  updateInvoiceStatus, getRevenueStats,

  // Safeguarding
  getSafeguardingIncidents, getSafeguardingByCase,
  getOpenIncidents, createSafeguardingIncident,
  updateSafeguardingStatus,

  // NACCC
  getNACCCReports, getNACCCReportsByCase,
  generateNACCCReport, updateNACCCReport,
};

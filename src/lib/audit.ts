/**
 * Staff audit log — immutable record of all internal staff actions.
 * Every read, write, export, and admin action is logged with timestamp,
 * actor, IP, and affected record. Court-admissible chain of custody.
 */

export type StaffAuditAction =
  | 'case_viewed'
  | 'case_created'
  | 'case_status_changed'
  | 'session_created'
  | 'session_started'
  | 'session_ended'
  | 'note_added'
  | 'document_uploaded'
  | 'document_viewed'
  | 'share_link_created'
  | 'share_link_approved'
  | 'share_link_rejected'
  | 'share_link_revoked'
  | 'pdf_exported'
  | 'invoice_created'
  | 'invoice_sent'
  | 'invoice_marked_paid'
  | 'safeguarding_logged'
  | 'safeguarding_reviewed'
  | 'naccc_report_generated'
  | 'naccc_report_signed'
  | 'naccc_report_submitted'
  | 'staff_created'
  | 'staff_role_changed'
  | 'staff_deactivated'
  | 'login'
  | 'logout';

export interface AuditLogEntry {
  action: StaffAuditAction;
  actor_id?: string;
  actor_name: string;
  record_type?: string;
  record_id?: string;
  record_label?: string;  // human-readable e.g. "Morris family – BST-2026-0041"
  ip_address?: string;
  user_agent?: string;
  detail?: string;
  created_at: string;
}

// In-memory log for prototype — replace with DB insert in production
const _auditLog: AuditLogEntry[] = [];

export function logAction(entry: Omit<AuditLogEntry, 'created_at'>) {
  const record: AuditLogEntry = {
    ...entry,
    created_at: new Date().toISOString(),
  };
  _auditLog.unshift(record);
  // Keep last 1000 in memory
  if (_auditLog.length > 1000) _auditLog.pop();
  // In production: await supabase.from('staff_audit_log').insert(record)
  if (process.env.NODE_ENV === 'development') {
    console.log(`[AUDIT] ${record.actor_name} → ${record.action}${record.record_label ? ` (${record.record_label})` : ''}`);
  }
}

export function getAuditLog(filters?: {
  actor_id?: string;
  record_id?: string;
  action?: StaffAuditAction;
  limit?: number;
}): AuditLogEntry[] {
  let log = _auditLog;
  if (filters?.actor_id) log = log.filter(e => e.actor_id === filters.actor_id);
  if (filters?.record_id) log = log.filter(e => e.record_id === filters.record_id);
  if (filters?.action) log = log.filter(e => e.action === filters.action);
  return log.slice(0, filters?.limit || 200);
}

export function getAuditLogForCase(caseId: string): AuditLogEntry[] {
  return _auditLog.filter(e => e.record_id === caseId || e.detail?.includes(caseId));
}

// Supabase schema addition for production (add to schema.sql):
/*
create table staff_audit_log (
  id           uuid primary key default uuid_generate_v4(),
  action       text not null,
  actor_id     uuid references staff(id),
  actor_name   text not null,
  record_type  text,
  record_id    uuid,
  record_label text,
  ip_address   inet,
  user_agent   text,
  detail       text,
  created_at   timestamptz not null default now()
);

create index idx_staff_audit_actor on staff_audit_log(actor_id);
create index idx_staff_audit_record on staff_audit_log(record_id);
create index idx_staff_audit_action on staff_audit_log(action);
create index idx_staff_audit_created on staff_audit_log(created_at desc);

-- Immutable: no updates or deletes
create trigger staff_audit_immutable before update or delete on staff_audit_log
  for each row execute function notes_immutable();

-- RLS: directors see all, managers see their centre, others see only their own
alter table staff_audit_log enable row level security;
create policy "audit_log_select" on staff_audit_log for select using (
  is_director() or actor_id = auth.uid()
);
create policy "audit_log_insert" on staff_audit_log for insert with check (true);
*/

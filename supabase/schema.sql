-- ============================================================
-- SafeSpace Contact Centre Management Platform
-- Supabase PostgreSQL Schema
-- Run this entire file in Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ── Enums ────────────────────────────────────────────────────────────────────

create type risk_flag as enum (
  'domestic_violence','court_injunction','safeguarding',
  'legal_proceedings','prohibited_steps_order'
);
create type referral_source as enum (
  'local_authority','private','cafcass','court_ordered'
);
create type case_status as enum (
  'intake','active','suspended','closed','archived'
);
create type session_type as enum (
  'supervised','supported','handover'
);
create type session_status as enum (
  'scheduled','in_progress','completed','dna','cancelled'
);
create type note_type as enum (
  'observation','welfare_concern','incident','recommendation'
);
create type person_role as enum (
  'child','resident_parent','non_resident_parent'
);
create type user_role as enum (
  'director','manager','supervisor','admin'
);
create type recipient_role as enum (
  'social_worker','cafcass','solicitor','court','other'
);
create type share_link_status as enum (
  'pending_approval','active','expired','revoked'
);
create type approval_status as enum (
  'pending','approved','rejected'
);
create type include_notes_scope as enum (
  'all','welfare_concern','observation','none'
);
create type invoice_status as enum (
  'draft','sent','paid','overdue','cancelled'
);
create type payment_method as enum (
  'invoice','stripe','bacs'
);
create type client_type as enum (
  'local_authority','private','cafcass'
);
create type safeguarding_status as enum (
  'open','referred','monitoring','closed'
);
create type safeguarding_category as enum (
  'physical_harm','emotional_harm','neglect','sexual_harm',
  'domestic_violence','parental_behaviour','other'
);
create type report_status as enum (
  'draft','signed','submitted'
);
create type audit_event as enum (
  'created','approved','rejected','viewed',
  'document_opened','revoked','expired'
);

-- ── Centres ──────────────────────────────────────────────────────────────────

create table centres (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  code        text not null unique,  -- e.g. BST
  address     text,
  phone       text,
  email       text,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ── Staff (extends Supabase auth.users) ──────────────────────────────────────

create table staff (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null,
  role        user_role not null default 'supervisor',
  centre_id   uuid references centres(id),
  dbs_number  text,
  dbs_expiry  date,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ── Cases ────────────────────────────────────────────────────────────────────

create table cases (
  id                uuid primary key default uuid_generate_v4(),
  case_ref          text not null unique,
  family_name       text not null,
  referral_source   referral_source not null,
  status            case_status not null default 'intake',
  risk_flags        risk_flag[] not null default '{}',
  keyworker_id      uuid references staff(id),
  centre_id         uuid not null references centres(id),
  legal_order_ref   text,
  social_worker     text,
  cafcass_officer   text,
  notes             text,
  created_by        uuid references staff(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index idx_cases_centre on cases(centre_id);
create index idx_cases_status on cases(status);
create index idx_cases_keyworker on cases(keyworker_id);

-- ── Persons (children + parents linked to cases) ─────────────────────────────

create table persons (
  id          uuid primary key default uuid_generate_v4(),
  case_id     uuid not null references cases(id) on delete cascade,
  full_name   text not null,
  dob         date,
  role        person_role not null,
  created_at  timestamptz not null default now()
);

create index idx_persons_case on persons(case_id);

-- ── Sessions ─────────────────────────────────────────────────────────────────

create table sessions (
  id               uuid primary key default uuid_generate_v4(),
  case_id          uuid not null references cases(id) on delete cascade,
  session_type     session_type not null,
  scheduled_start  timestamptz not null,
  scheduled_end    timestamptz not null,
  actual_start     timestamptz,
  actual_end       timestamptz,
  supervisor_id    uuid references staff(id),
  room             text,
  status           session_status not null default 'scheduled',
  created_by       uuid references staff(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index idx_sessions_case on sessions(case_id);
create index idx_sessions_start on sessions(scheduled_start);
create index idx_sessions_status on sessions(status);

-- ── Session attendees ─────────────────────────────────────────────────────────

create table session_attendees (
  id           uuid primary key default uuid_generate_v4(),
  session_id   uuid not null references sessions(id) on delete cascade,
  person_id    uuid not null references persons(id) on delete cascade,
  arrived_at   timestamptz,
  departed_at  timestamptz,
  unique(session_id, person_id)
);

-- ── Notes ────────────────────────────────────────────────────────────────────

create table notes (
  id                  uuid primary key default uuid_generate_v4(),
  session_id          uuid references sessions(id) on delete cascade,
  case_id             uuid not null references cases(id) on delete cascade,
  note_type           note_type not null,
  body                text not null,
  author_id           uuid references staff(id),
  visible_externally  boolean not null default true,
  -- Immutable: never allow updates after creation
  created_at          timestamptz not null default now()
);

create index idx_notes_session on notes(session_id);
create index idx_notes_case on notes(case_id);
create index idx_notes_type on notes(note_type);

-- Prevent updates to notes (immutability for legal record)
create or replace function notes_immutable()
returns trigger language plpgsql as $$
begin
  raise exception 'Notes are immutable records and cannot be modified';
end;
$$;

create trigger notes_no_update
  before update on notes
  for each row execute function notes_immutable();

-- ── Documents ────────────────────────────────────────────────────────────────

create table documents (
  id           uuid primary key default uuid_generate_v4(),
  case_id      uuid not null references cases(id) on delete cascade,
  name         text not null,
  type         text not null,
  storage_path text not null,  -- Supabase Storage path
  size_bytes   bigint,
  uploaded_by  uuid references staff(id),
  uploaded_at  timestamptz not null default now()
);

create index idx_documents_case on documents(case_id);

-- ── Share links (Phase 2) ─────────────────────────────────────────────────────

create table share_links (
  id                  uuid primary key default uuid_generate_v4(),
  token               text not null unique default encode(gen_random_bytes(32), 'hex'),
  case_id             uuid not null references cases(id) on delete cascade,
  recipient_name      text not null,
  recipient_email     text not null,
  recipient_role      recipient_role not null,
  -- Scope (what is shared)
  session_ids         uuid[] not null default '{}',
  include_notes       include_notes_scope not null default 'all',
  include_documents   boolean not null default false,
  include_recordings  boolean not null default false,
  -- Meta
  purpose             text not null,
  expires_at          timestamptz not null,
  status              share_link_status not null default 'pending_approval',
  approval_status     approval_status not null default 'pending',
  approved_by         uuid references staff(id),
  approved_at         timestamptz,
  rejection_reason    text,
  view_count          int not null default 0,
  created_by          uuid references staff(id),
  created_at          timestamptz not null default now()
);

create index idx_share_links_case on share_links(case_id);
create index idx_share_links_token on share_links(token);
create index idx_share_links_status on share_links(status);

-- ── Share link audit log ──────────────────────────────────────────────────────

create table share_audit_log (
  id              uuid primary key default uuid_generate_v4(),
  share_link_id   uuid not null references share_links(id) on delete cascade,
  event           audit_event not null,
  actor           text not null,  -- staff name or recipient email
  ip_address      inet,
  user_agent      text,
  detail          text,
  created_at      timestamptz not null default now()
);

create index idx_audit_share_link on share_audit_log(share_link_id);

-- Audit log is immutable
create trigger audit_no_update
  before update on share_audit_log
  for each row execute function notes_immutable();

-- ── Invoices (Phase 3) ────────────────────────────────────────────────────────

create table invoices (
  id                   uuid primary key default uuid_generate_v4(),
  invoice_number       text not null unique,
  case_id              uuid not null references cases(id) on delete restrict,
  client_name          text not null,
  client_email         text not null,
  client_type          client_type not null,
  subtotal             numeric(10,2) not null default 0,
  vat                  numeric(10,2) not null default 0,
  total                numeric(10,2) not null default 0,
  status               invoice_status not null default 'draft',
  payment_method       payment_method not null default 'invoice',
  stripe_payment_id    text,
  stripe_payment_link  text,
  notes                text,
  issued_at            timestamptz,
  due_at               timestamptz,
  paid_at              timestamptz,
  created_by           uuid references staff(id),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index idx_invoices_case on invoices(case_id);
create index idx_invoices_status on invoices(status);

create table invoice_lines (
  id           uuid primary key default uuid_generate_v4(),
  invoice_id   uuid not null references invoices(id) on delete cascade,
  description  text not null,
  line_type    text not null,
  quantity     numeric(8,2) not null default 1,
  unit_price   numeric(10,2) not null,
  total        numeric(10,2) not null,
  session_id   uuid references sessions(id),
  sort_order   int not null default 0
);

create index idx_invoice_lines_invoice on invoice_lines(invoice_id);

-- ── Safeguarding incidents (Phase 3) ─────────────────────────────────────────

create table safeguarding_incidents (
  id                      uuid primary key default uuid_generate_v4(),
  case_id                 uuid not null references cases(id) on delete restrict,
  session_id              uuid references sessions(id),
  category                safeguarding_category not null,
  description             text not null,
  immediate_action_taken  text not null,
  reported_by             uuid references staff(id),
  reported_at             timestamptz not null default now(),
  status                  safeguarding_status not null default 'open',
  referral_agency         text,
  referral_ref            text,
  referral_date           date,
  manager_review          text,
  manager_reviewed_by     uuid references staff(id),
  manager_reviewed_at     timestamptz,
  outcome                 text,
  closed_at               timestamptz,
  children_involved       text[] not null default '{}',
  follow_up_actions       text[] not null default '{}'
);

create index idx_safeguarding_case on safeguarding_incidents(case_id);
create index idx_safeguarding_status on safeguarding_incidents(status);

-- ── NACCC reports (Phase 3) ───────────────────────────────────────────────────

create table naccc_reports (
  id                      uuid primary key default uuid_generate_v4(),
  case_id                 uuid not null references cases(id) on delete restrict,
  period_start            date not null,
  period_end              date not null,
  session_count           int not null default 0,
  dna_count               int not null default 0,
  cancelled_count         int not null default 0,
  welfare_concerns_count  int not null default 0,
  incidents_count         int not null default 0,
  summary                 text not null default '',
  recommendations         text not null default '',
  supervisor_sign         text,
  supervisor_signed_at    timestamptz,
  manager_sign            text,
  manager_signed_at       timestamptz,
  status                  report_status not null default 'draft',
  submitted_at            timestamptz,
  generated_by            uuid references staff(id),
  generated_at            timestamptz not null default now()
);

create index idx_naccc_case on naccc_reports(case_id);

-- ── Auto-update updated_at ────────────────────────────────────────────────────

create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger cases_updated_at before update on cases
  for each row execute function update_updated_at();
create trigger sessions_updated_at before update on sessions
  for each row execute function update_updated_at();
create trigger invoices_updated_at before update on invoices
  for each row execute function update_updated_at();

-- ── Auto-expire share links ───────────────────────────────────────────────────

create or replace function expire_share_links()
returns void language plpgsql as $$
begin
  update share_links
  set status = 'expired'
  where status = 'active' and expires_at < now();
end;
$$;

-- ── Case reference generator ──────────────────────────────────────────────────

create sequence case_ref_seq start 1;

create or replace function generate_case_ref(centre_code text)
returns text language plpgsql as $$
declare
  seq_val int;
  year_val int;
begin
  seq_val := nextval('case_ref_seq');
  year_val := extract(year from now());
  return upper(centre_code) || '-' || year_val || '-' || lpad(seq_val::text, 4, '0');
end;
$$;

-- ── Invoice number generator ──────────────────────────────────────────────────

create sequence invoice_seq start 1;

create or replace function generate_invoice_number()
returns text language plpgsql as $$
begin
  return 'INV-' || extract(year from now()) || '-' || lpad(nextval('invoice_seq')::text, 4, '0');
end;
$$;

-- ── Row Level Security ────────────────────────────────────────────────────────
-- Staff can only see data for their own centre
-- Directors can see all centres

alter table cases enable row level security;
alter table sessions enable row level security;
alter table notes enable row level security;
alter table documents enable row level security;
alter table persons enable row level security;
alter table share_links enable row level security;
alter table share_audit_log enable row level security;
alter table invoices enable row level security;
alter table invoice_lines enable row level security;
alter table safeguarding_incidents enable row level security;
alter table naccc_reports enable row level security;

-- Helper: get current user's staff record
create or replace function current_staff()
returns staff language sql security definer as $$
  select * from staff where id = auth.uid();
$$;

-- Helper: is current user a director?
create or replace function is_director()
returns boolean language sql security definer as $$
  select role = 'director' from staff where id = auth.uid();
$$;

-- Helper: is current user a manager or director?
create or replace function is_manager_or_above()
returns boolean language sql security definer as $$
  select role in ('director','manager') from staff where id = auth.uid();
$$;

-- Cases: staff see cases in their centre, directors see all
create policy "cases_select" on cases for select using (
  is_director() or centre_id = (select centre_id from staff where id = auth.uid())
);
create policy "cases_insert" on cases for insert with check (
  centre_id = (select centre_id from staff where id = auth.uid()) or is_director()
);
create policy "cases_update" on cases for update using (
  centre_id = (select centre_id from staff where id = auth.uid()) or is_director()
);

-- Sessions: same centre scoping
create policy "sessions_select" on sessions for select using (
  is_director() or case_id in (
    select id from cases where centre_id = (select centre_id from staff where id = auth.uid())
  )
);
create policy "sessions_insert" on sessions for insert with check (
  case_id in (
    select id from cases where centre_id = (select centre_id from staff where id = auth.uid())
  ) or is_director()
);
create policy "sessions_update" on sessions for update using (
  case_id in (
    select id from cases where centre_id = (select centre_id from staff where id = auth.uid())
  ) or is_director()
);

-- Notes: select same centre, insert only, no update (immutable enforced by trigger)
create policy "notes_select" on notes for select using (
  is_director() or case_id in (
    select id from cases where centre_id = (select centre_id from staff where id = auth.uid())
  )
);
create policy "notes_insert" on notes for insert with check (
  case_id in (
    select id from cases where centre_id = (select centre_id from staff where id = auth.uid())
  ) or is_director()
);

-- Persons, documents, share links, invoices, safeguarding, naccc: same pattern
create policy "persons_select" on persons for select using (
  is_director() or case_id in (select id from cases where centre_id=(select centre_id from staff where id=auth.uid()))
);
create policy "persons_all" on persons for all using (
  is_director() or case_id in (select id from cases where centre_id=(select centre_id from staff where id=auth.uid()))
);

create policy "documents_select" on documents for select using (
  is_director() or case_id in (select id from cases where centre_id=(select centre_id from staff where id=auth.uid()))
);
create policy "documents_insert" on documents for insert with check (
  case_id in (select id from cases where centre_id=(select centre_id from staff where id=auth.uid())) or is_director()
);

create policy "share_links_select" on share_links for select using (
  is_director() or case_id in (select id from cases where centre_id=(select centre_id from staff where id=auth.uid()))
);
create policy "share_links_insert" on share_links for insert with check (
  case_id in (select id from cases where centre_id=(select centre_id from staff where id=auth.uid())) or is_director()
);
create policy "share_links_update" on share_links for update using (
  is_manager_or_above() or case_id in (select id from cases where centre_id=(select centre_id from staff where id=auth.uid()))
);

create policy "audit_select" on share_audit_log for select using (
  is_director() or share_link_id in (
    select sl.id from share_links sl
    join cases c on c.id = sl.case_id
    where c.centre_id = (select centre_id from staff where id=auth.uid())
  )
);
create policy "audit_insert" on share_audit_log for insert with check (true);

create policy "invoices_select" on invoices for select using (
  is_director() or case_id in (select id from cases where centre_id=(select centre_id from staff where id=auth.uid()))
);
create policy "invoices_all" on invoices for all using (
  is_director() or case_id in (select id from cases where centre_id=(select centre_id from staff where id=auth.uid()))
);

create policy "invoice_lines_select" on invoice_lines for select using (
  invoice_id in (select id from invoices)
);
create policy "invoice_lines_all" on invoice_lines for all using (
  invoice_id in (select id from invoices)
);

create policy "safeguarding_select" on safeguarding_incidents for select using (
  is_director() or case_id in (select id from cases where centre_id=(select centre_id from staff where id=auth.uid()))
);
create policy "safeguarding_insert" on safeguarding_incidents for insert with check (
  case_id in (select id from cases where centre_id=(select centre_id from staff where id=auth.uid())) or is_director()
);
create policy "safeguarding_update" on safeguarding_incidents for update using (
  is_manager_or_above()
);

create policy "naccc_select" on naccc_reports for select using (
  is_director() or case_id in (select id from cases where centre_id=(select centre_id from staff where id=auth.uid()))
);
create policy "naccc_all" on naccc_reports for all using (
  is_director() or case_id in (select id from cases where centre_id=(select centre_id from staff where id=auth.uid()))
);

-- ── Seed data: centre ─────────────────────────────────────────────────────────

insert into centres (id, name, code, address, phone, email) values
  ('00000000-0000-0000-0000-000000000001', 'SafeSpace Basingstoke', 'BST',
   '12 London Road, Basingstoke, RG21 2AB', '01256 000000', 'info@safespace-basingstoke.co.uk');

-- ── Storage buckets ───────────────────────────────────────────────────────────
-- Run these in Supabase Dashboard → Storage after running this SQL:
--
-- 1. Create bucket: "documents"  (private, 20MB max, PDF/DOCX/JPEG allowed)
-- 2. Create bucket: "recordings" (private, 500MB max, MP4/M4A allowed)
--
-- Storage RLS policies (add in Dashboard):
-- documents: authenticated users can upload to their centre's folder
-- recordings: authenticated users can upload, no public access ever

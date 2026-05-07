-- ============================================================
-- SafeSpace — Schema additions (run after schema.sql)
-- New features: rota, waiting list, comms log, DBS tracking,
--               session feedback, staff audit log
-- ============================================================

-- ── Staff availability / rota ────────────────────────────────────────────────

create table staff_availability (
  id           uuid primary key default uuid_generate_v4(),
  staff_id     uuid not null references staff(id) on delete cascade,
  day_of_week  int not null check (day_of_week between 0 and 6), -- 0=Sun
  start_time   time not null,
  end_time     time not null,
  valid_from   date not null default current_date,
  valid_until  date,
  created_at   timestamptz not null default now()
);

create table staff_unavailability (
  id           uuid primary key default uuid_generate_v4(),
  staff_id     uuid not null references staff(id) on delete cascade,
  date         date not null,
  reason       text,
  created_at   timestamptz not null default now()
);

-- ── DBS tracking ──────────────────────────────────────────────────────────────

create table dbs_records (
  id             uuid primary key default uuid_generate_v4(),
  staff_id       uuid not null references staff(id) on delete cascade,
  dbs_number     text not null,
  issue_date     date not null,
  expiry_date    date not null,
  update_service boolean not null default false,
  verified_by    uuid references staff(id),
  verified_at    timestamptz,
  created_at     timestamptz not null default now()
);

create index idx_dbs_staff on dbs_records(staff_id);
create index idx_dbs_expiry on dbs_records(expiry_date);

-- ── Waiting list ──────────────────────────────────────────────────────────────

create type waiting_list_status as enum ('waiting','active','withdrawn','completed');
create type session_type_requested as enum ('supervised','supported','handover','any');

create table waiting_list (
  id                   uuid primary key default uuid_generate_v4(),
  centre_id            uuid not null references centres(id),
  family_name          text not null,
  referral_source      referral_source not null,
  session_type_needed  session_type_requested not null default 'any',
  la_name              text,
  social_worker        text,
  social_worker_email  text,
  risk_flags           risk_flag[] not null default '{}',
  notes                text,
  priority             int not null default 3 check (priority between 1 and 5),
  status               waiting_list_status not null default 'waiting',
  referred_at          timestamptz not null default now(),
  activated_at         timestamptz,  -- when converted to a case
  case_id              uuid references cases(id),
  created_by           uuid references staff(id),
  created_at           timestamptz not null default now()
);

create index idx_waiting_centre on waiting_list(centre_id);
create index idx_waiting_status on waiting_list(status);

-- ── Communication log ─────────────────────────────────────────────────────────

create type comm_direction as enum ('inbound','outbound');
create type comm_channel as enum ('phone','email','letter','in_person','other');
create type comm_party as enum ('resident_parent','non_resident_parent','social_worker','cafcass','solicitor','court','other');

create table communication_log (
  id              uuid primary key default uuid_generate_v4(),
  case_id         uuid not null references cases(id) on delete cascade,
  direction       comm_direction not null,
  channel         comm_channel not null,
  party           comm_party not null,
  party_name      text not null,
  subject         text,
  summary         text not null,
  action_required text,
  logged_by       uuid references staff(id),
  communicated_at timestamptz not null,
  created_at      timestamptz not null default now()
);

create index idx_comms_case on communication_log(case_id);
create index idx_comms_date on communication_log(communicated_at desc);

-- ── Session feedback form ─────────────────────────────────────────────────────

create table session_feedback (
  id                    uuid primary key default uuid_generate_v4(),
  session_id            uuid not null references sessions(id) on delete cascade,
  case_id               uuid not null references cases(id) on delete cascade,
  -- Structured ratings 1-5
  child_presentation    int check (child_presentation between 1 and 5),
  interaction_quality   int check (interaction_quality between 1 and 5),
  nrp_engagement        int check (nrp_engagement between 1 and 5),
  environment_suitability int check (environment_suitability between 1 and 5),
  -- Written fields
  session_summary       text not null default '',
  child_welfare_notes   text,
  concerns_raised       text,
  recommendations       text,
  frequency_recommendation text, -- e.g. 'maintain fortnightly', 'reduce to monthly'
  -- Sign off
  completed_by          uuid references staff(id),
  completed_at          timestamptz,
  reviewed_by           uuid references staff(id),
  reviewed_at           timestamptz,
  status                text not null default 'draft' check (status in ('draft','submitted','reviewed')),
  created_at            timestamptz not null default now()
);

create index idx_feedback_session on session_feedback(session_id);
create index idx_feedback_case on session_feedback(case_id);

-- ── Staff audit log ───────────────────────────────────────────────────────────

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
create index idx_staff_audit_created on staff_audit_log(created_at desc);

create trigger staff_audit_immutable
  before update or delete on staff_audit_log
  for each row execute function notes_immutable();

alter table staff_audit_log enable row level security;
create policy "audit_log_select" on staff_audit_log for select using (is_director() or actor_id = auth.uid());
create policy "audit_log_insert" on staff_audit_log for insert with check (true);

-- ── Invoice chase log ─────────────────────────────────────────────────────────

create table invoice_chase_log (
  id          uuid primary key default uuid_generate_v4(),
  invoice_id  uuid not null references invoices(id) on delete cascade,
  chased_at   timestamptz not null default now(),
  chase_day   int not null,  -- 7, 14, 30
  sent_to     text not null,
  sent_by     text not null default 'system'
);

-- ── Enable RLS on new tables ──────────────────────────────────────────────────

alter table staff_availability enable row level security;
alter table staff_unavailability enable row level security;
alter table dbs_records enable row level security;
alter table waiting_list enable row level security;
alter table communication_log enable row level security;
alter table session_feedback enable row level security;
alter table invoice_chase_log enable row level security;

create policy "availability_all" on staff_availability for all using (
  is_manager_or_above() or staff_id = auth.uid()
);
create policy "unavailability_all" on staff_unavailability for all using (
  is_manager_or_above() or staff_id = auth.uid()
);
create policy "dbs_select" on dbs_records for select using (
  is_manager_or_above() or staff_id = auth.uid()
);
create policy "dbs_insert" on dbs_records for insert with check (is_manager_or_above());
create policy "waiting_list_all" on waiting_list for all using (
  is_director() or centre_id = (select centre_id from staff where id = auth.uid())
);
create policy "comms_select" on communication_log for select using (
  is_director() or case_id in (select id from cases where centre_id=(select centre_id from staff where id=auth.uid()))
);
create policy "comms_insert" on communication_log for insert with check (
  case_id in (select id from cases where centre_id=(select centre_id from staff where id=auth.uid())) or is_director()
);
create policy "feedback_all" on session_feedback for all using (
  is_director() or case_id in (select id from cases where centre_id=(select centre_id from staff where id=auth.uid()))
);
create policy "chase_log_all" on invoice_chase_log for all using (
  is_director() or invoice_id in (select id from invoices)
);

-- ── Gmail token storage ───────────────────────────────────────────────────────
-- Tokens are encrypted at rest by Supabase (enable Vault in production)

create table gmail_tokens (
  id            uuid primary key default uuid_generate_v4(),
  staff_id      uuid not null references staff(id) on delete cascade unique,
  email         text not null,
  access_token  text not null,  -- Encrypt with Supabase Vault in production
  refresh_token text,           -- Encrypt with Supabase Vault in production
  expiry_date   bigint,
  scope         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table gmail_tokens enable row level security;
-- Staff can only see/manage their own tokens; service role for webhook
create policy "gmail_tokens_own" on gmail_tokens for all using (staff_id = auth.uid());

-- ── Extend communication_log with Gmail fields ────────────────────────────────

alter table communication_log
  add column if not exists gmail_id           text unique,
  add column if not exists gmail_thread_id    text,
  add column if not exists source             text default 'manual',
  add column if not exists match_confidence   text,
  add column if not exists match_reason       text,
  add column if not exists has_attachments    boolean default false;

create index if not exists idx_comms_gmail_id on communication_log(gmail_id);

-- ── Gmail watch history tracking ──────────────────────────────────────────────

create table gmail_watch_state (
  id            uuid primary key default uuid_generate_v4(),
  staff_id      uuid not null references staff(id) on delete cascade unique,
  history_id    text not null,
  expiration    bigint,
  updated_at    timestamptz not null default now()
);

-- ── Contact phone numbers (per case) ─────────────────────────────────────────
-- Stores verified phone numbers for every party on a case
-- Enables reliable auto-matching for call logs

create table contact_numbers (
  id           uuid primary key default uuid_generate_v4(),
  case_id      uuid not null references cases(id) on delete cascade,
  person_id    uuid references persons(id),
  party        comm_party not null,
  party_name   text not null,
  phone_number text not null,  -- stored normalised: +44xxxxxxxxxx
  number_type  text not null default 'direct'  -- direct, mobile, office, fax
    check (number_type in ('direct','mobile','office','home','fax')),
  is_primary   boolean not null default false,
  verified     boolean not null default false,
  notes        text,
  added_by     uuid references staff(id),
  created_at   timestamptz not null default now()
);

create index idx_contact_numbers_case on contact_numbers(case_id);
create index idx_contact_numbers_phone on contact_numbers(phone_number);

alter table contact_numbers enable row level security;
create policy "contact_numbers_select" on contact_numbers for select using (
  is_director() or case_id in (select id from cases where centre_id=(select centre_id from staff where id=auth.uid()))
);
create policy "contact_numbers_insert" on contact_numbers for insert with check (
  case_id in (select id from cases where centre_id=(select centre_id from staff where id=auth.uid())) or is_director()
);

-- ── Extend communication_log for call metadata ────────────────────────────────

alter table communication_log
  add column if not exists call_id                text,
  add column if not exists call_duration_seconds  int,
  add column if not exists phone_number           text,
  add column if not exists recording_url          text,
  add column if not exists needs_review           boolean default false,
  add column if not exists voicemail_transcript   text;

create index if not exists idx_comms_call_id on communication_log(call_id);
create index if not exists idx_comms_needs_review on communication_log(needs_review) where needs_review = true;

-- ── Google Voice watch state ──────────────────────────────────────────────────

create table if not exists google_voice_sync (
  id           uuid primary key default uuid_generate_v4(),
  staff_id     uuid not null references staff(id) on delete cascade unique,
  last_sync_at timestamptz,
  last_call_id text,   -- most recent call ID seen, for deduplication
  enabled      boolean not null default true,
  updated_at   timestamptz not null default now()
);

alter table google_voice_sync enable row level security;
create policy "voice_sync_own" on google_voice_sync for all using (staff_id = auth.uid());

-- ── Twilio call queue (unmatched inbound calls pending review) ────────────────

create table call_review_queue (
  id              uuid primary key default uuid_generate_v4(),
  call_sid        text not null unique,
  from_number     text not null,
  to_number       text not null,
  direction       text not null,
  duration_secs   int not null default 0,
  recording_url   text,
  called_at       timestamptz not null,
  reviewed        boolean not null default false,
  tagged_case_id  uuid references cases(id),
  reviewed_by     uuid references staff(id),
  reviewed_at     timestamptz,
  created_at      timestamptz not null default now()
);

create index idx_call_queue_reviewed on call_review_queue(reviewed) where reviewed = false;

alter table call_review_queue enable row level security;
create policy "call_queue_all" on call_review_queue for all using (
  is_manager_or_above()
);

-- ── Phone call columns on communication_log ───────────────────────────────────

alter table communication_log
  add column if not exists call_id              text,
  add column if not exists call_duration_seconds int,
  add column if not exists phone_number         text,
  add column if not exists recording_url        text,
  add column if not exists needs_review         boolean default false;

create index if not exists idx_comms_call_id on communication_log(call_id);
create index if not exists idx_comms_phone on communication_log(phone_number);
create index if not exists idx_comms_needs_review on communication_log(needs_review) where needs_review = true;

-- ── Google Voice watch state ───────────────────────────────────────────────────

create table if not exists google_voice_sync (
  id          uuid primary key default uuid_generate_v4(),
  staff_id    uuid not null references staff(id) on delete cascade unique,
  last_synced timestamptz,
  call_count  int not null default 0,
  updated_at  timestamptz not null default now()
);

alter table google_voice_sync enable row level security;
create policy "voice_sync_own" on google_voice_sync for all using (staff_id = auth.uid());

-- ── Video recordings ──────────────────────────────────────────────────────────

create type video_status as enum (
  'uploading',    -- upload in progress
  'processing',   -- transcoding via Cloudflare Stream
  'ready',        -- available for viewing
  'failed',       -- upload or transcoding failed
  'archived',     -- moved to cold storage (R2 Infrequent Access)
  'deleted'       -- permanently deleted (after retention period)
);

create type consent_status as enum (
  'obtained',     -- written consent on file
  'verbal',       -- verbal consent recorded in notes
  'court_ordered', -- court order requires recording
  'not_required'  -- session type doesn't require consent (e.g. handover)
);

create table recordings (
  id                    uuid primary key default uuid_generate_v4(),

  -- Case / session linkage
  session_id            uuid not null references sessions(id) on delete restrict,
  case_id               uuid not null references cases(id) on delete restrict,

  -- File metadata
  original_filename     text not null,
  file_size_bytes       bigint,
  duration_seconds      int,
  recorded_at           timestamptz not null,  -- actual recording start time
  uploaded_at           timestamptz not null default now(),
  uploaded_by           uuid references staff(id),

  -- Storage
  r2_key                text not null unique,  -- path in R2 bucket
  stream_uid            text unique,           -- Cloudflare Stream video UID
  stream_status         video_status not null default 'uploading',
  thumbnail_url         text,                  -- Stream-generated thumbnail

  -- Chain of custody
  sha256_hash           text,           -- hash of original file (integrity check)
  camera_id             text,           -- which camera (if multiple rooms)
  room                  text,
  centre_id             uuid references centres(id),

  -- Consent
  consent_status        consent_status not null default 'obtained',
  consent_obtained_by   uuid references staff(id),
  consent_obtained_at   timestamptz,
  consent_document_id   uuid references documents(id), -- link to signed consent form

  -- Sharing controls
  shareable_externally  boolean not null default false,
  court_evidence        boolean not null default false,  -- flagged for court bundle

  -- Retention
  retain_until          timestamptz,  -- auto-calculated from uploaded_at + 7 years
  deletion_approved_by  uuid references staff(id),
  deletion_approved_at  timestamptz,

  -- Notes
  description           text,
  created_at            timestamptz not null default now()
);

create index idx_recordings_session on recordings(session_id);
create index idx_recordings_case on recordings(case_id);
create index idx_recordings_status on recordings(stream_status);
create index idx_recordings_retain on recordings(retain_until);

-- ── Recording access log (immutable — every view is recorded) ─────────────────

create table recording_access_log (
  id              uuid primary key default uuid_generate_v4(),
  recording_id    uuid not null references recordings(id) on delete restrict,
  accessor_type   text not null,  -- 'staff' or 'external'
  accessor_id     uuid,           -- staff.id if internal
  accessor_email  text,           -- recipient email if external
  share_link_id   uuid references share_links(id),
  ip_address      inet,
  user_agent      text,
  token_expires   timestamptz,    -- when the stream token expired
  accessed_at     timestamptz not null default now()
);

create index idx_rec_access_recording on recording_access_log(recording_id);
create index idx_rec_access_time on recording_access_log(accessed_at desc);

-- Immutable
create trigger rec_access_immutable
  before update or delete on recording_access_log
  for each row execute function notes_immutable();

-- ── RLS ───────────────────────────────────────────────────────────────────────

alter table recordings enable row level security;
alter table recording_access_log enable row level security;

create policy "recordings_select" on recordings for select using (
  is_director() or case_id in (
    select id from cases where centre_id=(select centre_id from staff where id=auth.uid())
  )
);

create policy "recordings_insert" on recordings for insert with check (
  case_id in (
    select id from cases where centre_id=(select centre_id from staff where id=auth.uid())
  ) or is_director()
);

-- Only directors and managers can update (status changes, sharing flags)
create policy "recordings_update" on recordings for update using (
  is_manager_or_above()
);

create policy "rec_access_select" on recording_access_log for select using (
  is_manager_or_above() or recording_id in (
    select id from recordings where case_id in (
      select id from cases where centre_id=(select centre_id from staff where id=auth.uid())
    )
  )
);

create policy "rec_access_insert" on recording_access_log for insert with check (true);

-- ── Auto-set retention date ───────────────────────────────────────────────────

create or replace function set_recording_retention()
returns trigger language plpgsql as $$
begin
  if new.retain_until is null then
    new.retain_until := new.uploaded_at + interval '7 years';
  end if;
  return new;
end;
$$;

create trigger recordings_set_retention
  before insert on recordings
  for each row execute function set_recording_retention();

-- ── Hardware config notes (reference only — no app logic needed) ──────────────
-- Google Voice Premier: automatic recording, all calls, stored in Google Vault
-- Poly VVX 350 OBi Edition: certified desk phone, zero-touch via Admin Console
-- Twilio: centre main number, full webhook + recording API, auto-logs to app
-- Session room recorders: upload manually to Supabase 'recordings' bucket

-- Extend communication_log with Vault reference for Google Voice recordings
alter table communication_log
  add column if not exists google_vault_ref text;  -- Google Vault event ID for GV recordings

-- Recording consent log (GDPR / legal requirement)
create table if not exists recording_consent_log (
  id           uuid primary key default uuid_generate_v4(),
  call_id      text,
  session_id   uuid references sessions(id),
  consent_type text not null check (consent_type in ('call_auto','call_manual','session','voicemail')),
  announced_at timestamptz not null default now(),
  announcement_text text  -- the exact words played/shown for consent
);

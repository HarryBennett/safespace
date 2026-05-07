import { CaseStatus, NoteType, ReferralSource, RiskFlag, SessionStatus, SessionType } from './store';

export function sessionTypeBadge(t: SessionType) {
  const map: Record<SessionType, string> = {
    supervised: 'bg-red-900/30 text-red-300 border border-red-800/40',
    supported: 'bg-blue-900/30 text-blue-300 border border-blue-800/40',
    handover: 'bg-teal-900/30 text-teal-300 border border-teal-800/40',
  };
  return map[t];
}

export function sessionStatusBadge(s: SessionStatus) {
  const map: Record<SessionStatus, string> = {
    scheduled: 'bg-slate-700/40 text-slate-300 border border-slate-600/30',
    in_progress: 'bg-green-900/30 text-green-300 border border-green-800/40',
    completed: 'bg-blue-900/30 text-blue-300 border border-blue-800/40',
    dna: 'bg-amber-900/30 text-amber-300 border border-amber-800/40',
    cancelled: 'bg-slate-700/40 text-slate-400 border border-slate-600/30',
  };
  return map[s];
}

export function caseStatusBadge(s: CaseStatus) {
  const map: Record<CaseStatus, string> = {
    intake: 'bg-amber-900/30 text-amber-300 border border-amber-800/40',
    active: 'bg-green-900/30 text-green-300 border border-green-800/40',
    suspended: 'bg-amber-900/30 text-amber-300 border border-amber-800/40',
    closed: 'bg-slate-700/40 text-slate-400 border border-slate-600/30',
    archived: 'bg-slate-700/40 text-slate-500 border border-slate-600/30',
  };
  return map[s];
}

export function noteTypeBadge(n: NoteType) {
  const map: Record<NoteType, string> = {
    observation: 'bg-blue-900/30 text-blue-300 border border-blue-800/40',
    welfare_concern: 'bg-red-900/30 text-red-300 border border-red-800/40',
    incident: 'bg-orange-900/30 text-orange-300 border border-orange-800/40',
    recommendation: 'bg-purple-900/30 text-purple-300 border border-purple-800/40',
  };
  return map[n];
}

export const riskFlagLabel: Record<RiskFlag, string> = {
  domestic_violence: 'DV history',
  court_injunction: 'Court injunction',
  safeguarding: 'Safeguarding concern',
  legal_proceedings: 'Legal proceedings',
  prohibited_steps_order: 'Prohibited steps order',
};

export const referralLabel: Record<ReferralSource, string> = {
  local_authority: 'Local authority',
  private: 'Private',
  cafcass: 'Cafcass',
  court_ordered: 'Court ordered',
};

export const sessionTypeLabel: Record<SessionType, string> = {
  supervised: 'Supervised',
  supported: 'Supported',
  handover: 'Handover',
};

export const sessionStatusLabel: Record<SessionStatus, string> = {
  scheduled: 'Scheduled',
  in_progress: 'In progress',
  completed: 'Completed',
  dna: 'DNA',
  cancelled: 'Cancelled',
};

export const noteTypeLabel: Record<NoteType, string> = {
  observation: 'Observation',
  welfare_concern: 'Welfare concern',
  incident: 'Incident',
  recommendation: 'Recommendation',
};

export function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) +
    ' · ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function ageFromDob(dob: string) {
  const diff = Date.now() - new Date(dob).getTime();
  return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
}

// ── Phase 2 helpers ───────────────────────────────────────────────────────────
import type { RecipientRole, ShareLinkStatus, ApprovalStatus } from './store';

export const recipientRoleLabel: Record<RecipientRole, string> = {
  social_worker: 'Social worker',
  cafcass: 'Cafcass officer',
  solicitor: 'Solicitor / barrister',
  court: 'Court',
  other: 'Other professional',
};

export function shareLinkStatusBadge(s: ShareLinkStatus) {
  const map: Record<ShareLinkStatus, string> = {
    pending_approval: 'bg-amber-900/30 text-amber-300 border border-amber-800/40',
    active: 'bg-green-900/30 text-green-300 border border-green-800/40',
    expired: 'bg-slate-700/40 text-slate-400 border border-slate-600/30',
    revoked: 'bg-red-900/20 text-red-400 border border-red-800/30',
  };
  return map[s];
}

export function shareLinkStatusLabel(s: ShareLinkStatus) {
  return { pending_approval: 'Pending approval', active: 'Active', expired: 'Expired', revoked: 'Revoked' }[s];
}

export function daysUntil(iso: string) {
  const diff = new Date(iso).getTime() - Date.now();
  return Math.ceil(diff / (24 * 60 * 60 * 1000));
}

export function auditEventLabel(e: string) {
  return { created: 'Link created', approved: 'Approved by manager', rejected: 'Rejected', viewed: 'Portal viewed', document_opened: 'Document opened', revoked: 'Link revoked', expired: 'Link expired' }[e] || e;
}

export function auditEventColor(e: string) {
  if (e === 'approved') return '#10B981';
  if (e === 'rejected' || e === 'revoked') return '#F87171';
  if (e === 'viewed' || e === 'document_opened') return '#3B82F6';
  if (e === 'expired') return '#94A3B8';
  return '#8A97B0';
}

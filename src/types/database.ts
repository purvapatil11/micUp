/**
 * Core domain types mirroring the Supabase schema.
 * Full generated DB types are not required; these cover application usage.
 */

export const ROLES = ["anchoring_officer", "deputy_anchoring_officer", "team_member"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  anchoring_officer: "Anchoring Officer",
  deputy_anchoring_officer: "Deputy Anchoring Officer",
  team_member: "Team Member",
};

export const PROFILE_STATUSES = ["active", "pending", "suspended"] as const;
export type ProfileStatus = (typeof PROFILE_STATUSES)[number];

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
  role: Role;
  status: ProfileStatus;
  created_at: string;
  updated_at: string;
}

export const SCRIPT_STATUSES = ["draft", "in_progress", "need_review", "ready"] as const;
export type ScriptStatus = (typeof SCRIPT_STATUSES)[number];

export const SCRIPT_STATUS_LABELS: Record<ScriptStatus, string> = {
  draft: "Draft",
  in_progress: "In Progress",
  need_review: "Need Review",
  ready: "Ready",
};

export const SCRIPT_CATEGORIES = [
  "opening",
  "welcome",
  "speaker_introduction",
  "transition",
  "prize_distribution",
  "closing",
  "custom",
] as const;
export type ScriptCategory = (typeof SCRIPT_CATEGORIES)[number];

export const SCRIPT_CATEGORY_LABELS: Record<ScriptCategory, string> = {
  opening: "Opening",
  welcome: "Welcome",
  speaker_introduction: "Speaker Introduction",
  transition: "Transition",
  prize_distribution: "Prize Distribution",
  closing: "Closing",
  custom: "Custom",
};

/** TipTap JSON document. Kept loose on purpose — TipTap owns its own typing. */
export type TipTapDoc = {
  type: "doc";
  content?: unknown[];
};

export interface Script {
  id: string;
  title: string;
  event_id: string | null;
  category: ScriptCategory;
  assigned_to: string[];
  content: TipTapDoc | null;
  status: ScriptStatus;
  revision: number;
  deadline: string | null;
  created_by: string;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  // joined
  event?: Pick<EventRow, "id" | "name" | "event_date"> | null;
  creator?: Pick<Profile, "id" | "full_name"> | null;
  last_editor?: Pick<Profile, "id" | "full_name"> | null;
}

export interface ScriptVersion {
  id: string;
  script_id: string;
  revision: number;
  title: string;
  content: TipTapDoc | null;
  status: ScriptStatus;
  note: string | null;
  created_by: string;
  created_at: string;
  author?: Pick<Profile, "id" | "full_name"> | null;
}

export interface ScriptComment {
  id: string;
  script_id: string;
  author_id: string;
  body: string;
  created_at: string;
  updated_at: string;
  author?: Pick<Profile, "id" | "full_name"> | null;
}

export const EVENT_STATUSES = ["upcoming", "in_progress", "completed", "cancelled"] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

export const EVENT_STATUS_LABELS: Record<EventStatus, string> = {
  upcoming: "Upcoming",
  in_progress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

export interface EventRow {
  id: string;
  name: string;
  description: string | null;
  event_date: string;
  start_time: string | null;
  end_time: string | null;
  venue: string | null;
  status: EventStatus;
  notes: string | null;
  attendance_enabled: boolean;
  latitude: number | null;
  longitude: number | null;
  geofence_radius_m: number | null;
  check_in_opens_at: string | null;
  check_in_closes_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  assignments?: EventAssignment[];
}

export interface EventAssignment {
  id: string;
  event_id: string;
  profile_id: string;
  responsibility: string | null;
  created_at: string;
  member?: Pick<Profile, "id" | "full_name" | "role"> | null;
}

export interface RunOfShowItem {
  id: string;
  event_id: string;
  sequence: number;
  start_time: string | null;
  segment_title: string;
  description: string | null;
  assigned_to: string | null;
  script_id: string | null;
  stage_cue: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  assignee?: Pick<Profile, "id" | "full_name"> | null;
  script?: Pick<Script, "id" | "title" | "status"> | null;
}

export const ANNOUNCEMENT_PRIORITIES = ["normal", "important", "urgent"] as const;
export type AnnouncementPriority = (typeof ANNOUNCEMENT_PRIORITIES)[number];

export const ANNOUNCEMENT_PRIORITY_LABELS: Record<AnnouncementPriority, string> = {
  normal: "Normal",
  important: "Important",
  urgent: "Urgent",
};

export interface Announcement {
  id: string;
  title: string;
  message: string;
  priority: AnnouncementPriority;
  author_id: string;
  created_at: string;
  updated_at: string;
  author?: Pick<Profile, "id" | "full_name"> | null;
  acknowledgement_count?: number;
  acknowledged_by_me?: boolean;
}

export type AttendanceStatus = "present" | "absent" | "excused";
export type AttendanceMethod = "gps" | "manual";

export interface AttendanceRecord {
  id: string;
  event_id: string;
  profile_id: string;
  status: AttendanceStatus;
  method: AttendanceMethod;
  checked_in_at: string | null;
  latitude: number | null;
  longitude: number | null;
  distance_m: number | null;
  marked_by: string | null;
  reason: string | null;
  created_at: string;
  updated_at: string;
  member?: Pick<Profile, "id" | "full_name" | "role"> | null;
  marker?: Pick<Profile, "id" | "full_name"> | null;
}

export interface AttendanceAuditLogEntry {
  id: string;
  event_id: string;
  profile_id: string | null;
  actor_id: string | null;
  action: string;
  outcome: string;
  distance_m: number | null;
  latitude: number | null;
  longitude: number | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

export interface TeamInvite {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  status: "pending" | "accepted" | "revoked" | "expired";
  expires_at: string;
  created_by: string;
  created_at: string;
}

import type { Role, ScriptStatus } from "@/types/database";

/** Officers (Anchoring + Deputy) hold administrative and approval authority. */
export function isOfficer(role: Role | null | undefined): boolean {
  return role === "anchoring_officer" || role === "deputy_anchoring_officer";
}

export function isAnchoringOfficer(role: Role | null | undefined): boolean {
  return role === "anchoring_officer";
}

export function canApproveScripts(role: Role | null | undefined): boolean {
  return isOfficer(role);
}

export function canManageEvents(role: Role | null | undefined): boolean {
  return isOfficer(role);
}

export function canPublishAnnouncements(role: Role | null | undefined): boolean {
  return isOfficer(role);
}

export function canManageTeam(role: Role | null | undefined): boolean {
  return isOfficer(role);
}

export function canCorrectAttendance(role: Role | null | undefined): boolean {
  return isOfficer(role);
}

export function canViewAttendanceReport(role: Role | null | undefined): boolean {
  return isOfficer(role);
}

/**
 * Who may edit a script (content, title, status): the Anchoring Officer,
 * a Deputy Anchoring Officer, the script's creator, or a member the script
 * is assigned to. Everyone else can read and comment, but not edit.
 */
export function canEditScript(check: {
  actorRole: Role | null | undefined;
  actorId: string;
  createdBy: string | null | undefined;
  assignedTo?: string[] | null;
}): boolean {
  if (isOfficer(check.actorRole)) return true;
  if (check.createdBy && check.createdBy === check.actorId) return true;
  return (check.assignedTo ?? []).includes(check.actorId);
}

/**
 * Statuses a member with the given role is allowed to set.
 *
 * - Everyone may move scripts through the authoring pipeline.
 * - Only officers may set `ready` (final approval).
 */
export function allowedStatusTransitions(role: Role): ScriptStatus[] {
  const base: ScriptStatus[] = ["draft", "in_progress", "need_review"];
  if (isOfficer(role)) {
    return [...base, "ready"];
  }
  return base;
}

export interface StatusChangeCheck {
  actorRole: Role;
  currentStatus: ScriptStatus;
  nextStatus: ScriptStatus;
  /** True when the save also changes script content (title/body). */
  contentChanged?: boolean;
}

export type StatusChangeResult =
  | { ok: true }
  | { ok: false; code: "FORBIDDEN_READY"; message: string }
  | { ok: false; code: "REVIEW_REQUIRED"; message: string };

/**
 * Central business rule for script status changes. Mirrored by a database
 * trigger (fn_scripts_guard) so neither server actions nor direct SQL can
 * bypass it.
 *
 * Rules:
 * 1. Only Anchoring/Deputy Anchoring Officers may set a script to Ready.
 * 2. Editing the content of a Ready script automatically requires review
 *    again — the caller must move the status off `ready` in the same save.
 *    An officer may subsequently re-approve explicitly.
 */
export function authorizeScriptStatusChange(check: StatusChangeCheck): StatusChangeResult {
  const { actorRole, currentStatus, nextStatus, contentChanged = false } = check;

  if (nextStatus === "ready" && !isOfficer(actorRole)) {
    return {
      ok: false,
      code: "FORBIDDEN_READY",
      message:
        "Only the Anchoring Officer or Deputy Anchoring Officer can mark a script as Ready.",
    };
  }

  if (
    contentChanged &&
    currentStatus === "ready" &&
    nextStatus === "ready"
  ) {
    return {
      ok: false,
      code: "REVIEW_REQUIRED",
      message:
        "This script was Ready and its content changed, so it must be reviewed again. Set the status to Need Review (or In Progress) to save, then ask an officer to re-approve.",
    };
  }

  return { ok: true };
}

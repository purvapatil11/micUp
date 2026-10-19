import { describe, it, expect } from "vitest";
import {
  isOfficer,
  isAnchoringOfficer,
  canApproveScripts,
  canManageEvents,
  canPublishAnnouncements,
  canManageTeam,
  canCorrectAttendance,
  allowedStatusTransitions,
  authorizeScriptStatusChange,
} from "@/lib/permissions";

describe("role helpers", () => {
  it("isOfficer returns true for anchoring and deputy officers", () => {
    expect(isOfficer("anchoring_officer")).toBe(true);
    expect(isOfficer("deputy_anchoring_officer")).toBe(true);
    expect(isOfficer("team_member")).toBe(false);
    expect(isOfficer(null)).toBe(false);
    expect(isOfficer(undefined)).toBe(false);
  });

  it("isAnchoringOfficer only matches the anchoring officer role", () => {
    expect(isAnchoringOfficer("anchoring_officer")).toBe(true);
    expect(isAnchoringOfficer("deputy_anchoring_officer")).toBe(false);
    expect(isAnchoringOfficer("team_member")).toBe(false);
  });

  it("permission gates all require officer role", () => {
    const officerRoles = ["anchoring_officer", "deputy_anchoring_officer"];
    const memberRole = "team_member";

    for (const gate of [
      canApproveScripts,
      canManageEvents,
      canPublishAnnouncements,
      canManageTeam,
      canCorrectAttendance,
    ]) {
      for (const role of officerRoles) {
        expect(gate(role)).toBe(true);
      }
      expect(gate(memberRole)).toBe(false);
    }
  });
});

describe("allowedStatusTransitions", () => {
  it("team members can only set draft, in_progress, need_review", () => {
    const allowed = allowedStatusTransitions("team_member");
    expect(allowed).toEqual(["draft", "in_progress", "need_review"]);
    expect(allowed).not.toContain("ready");
  });

  it("officers can set all four statuses including ready", () => {
    for (const role of ["anchoring_officer", "deputy_anchoring_officer"] as const) {
      const allowed = allowedStatusTransitions(role);
      expect(allowed).toEqual(["draft", "in_progress", "need_review", "ready"]);
      expect(allowed).toContain("ready");
    }
  });
});

describe("authorizeScriptStatusChange", () => {
  it("blocks team members from setting ready", () => {
    const result = authorizeScriptStatusChange({
      actorRole: "team_member",
      currentStatus: "need_review",
      nextStatus: "ready",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("FORBIDDEN_READY");
    }
  });

  it("allows officers to set ready", () => {
    const result = authorizeScriptStatusChange({
      actorRole: "anchoring_officer",
      currentStatus: "need_review",
      nextStatus: "ready",
    });
    expect(result.ok).toBe(true);
  });

  it("allows deputies to set ready", () => {
    const result = authorizeScriptStatusChange({
      actorRole: "deputy_anchoring_officer",
      currentStatus: "need_review",
      nextStatus: "ready",
    });
    expect(result.ok).toBe(true);
  });

  it("allows team members to set draft/in_progress/need_review", () => {
    for (const nextStatus of ["draft", "in_progress", "need_review"] as const) {
      const result = authorizeScriptStatusChange({
        actorRole: "team_member",
        currentStatus: "draft",
        nextStatus,
      });
      expect(result.ok).toBe(true);
    }
  });

  it("rejects editing a Ready script while keeping it Ready", () => {
    const result = authorizeScriptStatusChange({
      actorRole: "anchoring_officer",
      currentStatus: "ready",
      nextStatus: "ready",
      contentChanged: true,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("REVIEW_REQUIRED");
    }
  });

  it("allows re-approving a Ready script when content has not changed", () => {
    const result = authorizeScriptStatusChange({
      actorRole: "anchoring_officer",
      currentStatus: "ready",
      nextStatus: "ready",
      contentChanged: false,
    });
    expect(result.ok).toBe(true);
  });

  it("allows editing a Ready script if the status moves off ready", () => {
    const result = authorizeScriptStatusChange({
      actorRole: "team_member",
      currentStatus: "ready",
      nextStatus: "need_review",
      contentChanged: true,
    });
    expect(result.ok).toBe(true);
  });
});

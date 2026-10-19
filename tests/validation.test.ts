import { describe, it, expect } from "vitest";
import {
  createScriptSchema,
  saveScriptSchema,
  createCommentSchema,
  checkInSchema,
  correctAttendanceSchema,
  createEventSchema,
  createAnnouncementSchema,
  updateProfileSchema,
} from "@/lib/validation";

describe("createScriptSchema", () => {
  it("accepts a valid script", () => {
    const result = createScriptSchema.safeParse({
      title: "Welcome speech",
      category: "welcome",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a title shorter than 2 characters", () => {
    const result = createScriptSchema.safeParse({ title: "A", category: "welcome" });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid category", () => {
    const result = createScriptSchema.safeParse({ title: "Hello world", category: "invalid" });
    expect(result.success).toBe(false);
  });

  it("accepts valid categories", () => {
    const categories = [
      "opening", "welcome", "speaker_introduction",
      "transition", "prize_distribution", "closing", "custom",
    ];
    for (const category of categories) {
      const result = createScriptSchema.safeParse({ title: "Test script", category });
      expect(result.success).toBe(true);
    }
  });
});

describe("saveScriptSchema", () => {
  it("accepts a valid save payload", () => {
    const result = saveScriptSchema.safeParse({
      scriptId: "aaaaaaaa-0000-4000-8000-000000000001",
      baseRevision: 3,
      title: "Updated title",
      content: { type: "doc", content: [] },
      status: "in_progress",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a non-positive base revision", () => {
    const result = saveScriptSchema.safeParse({
      scriptId: "aaaaaaaa-0000-4000-8000-000000000001",
      baseRevision: 0,
      title: "Updated title",
      content: null,
      status: "draft",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid status", () => {
    const result = saveScriptSchema.safeParse({
      scriptId: "aaaaaaaa-0000-4000-8000-000000000001",
      baseRevision: 1,
      title: "Test",
      content: null,
      status: "approved",
    });
    expect(result.success).toBe(false);
  });
});

describe("createCommentSchema", () => {
  it("accepts a valid comment", () => {
    const result = createCommentSchema.safeParse({
      scriptId: "aaaaaaaa-0000-4000-8000-000000000001",
      body: "Great opening line!",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty comment", () => {
    const result = createCommentSchema.safeParse({
      scriptId: "aaaaaaaa-0000-4000-8000-000000000001",
      body: "   ",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a comment over 4000 characters", () => {
    const result = createCommentSchema.safeParse({
      scriptId: "aaaaaaaa-0000-4000-8000-000000000001",
      body: "x".repeat(4001),
    });
    expect(result.success).toBe(false);
  });
});

describe("checkInSchema", () => {
  it("accepts valid coordinates", () => {
    const result = checkInSchema.safeParse({
      eventId: "aaaaaaaa-0000-4000-8000-000000000001",
      latitude: 28.6139,
      longitude: 77.209,
    });
    expect(result.success).toBe(true);
  });

  it("rejects out-of-range latitude", () => {
    const result = checkInSchema.safeParse({
      eventId: "aaaaaaaa-0000-4000-8000-000000000001",
      latitude: 95,
      longitude: 77.209,
    });
    expect(result.success).toBe(false);
  });

  it("rejects out-of-range longitude", () => {
    const result = checkInSchema.safeParse({
      eventId: "aaaaaaaa-0000-4000-8000-000000000001",
      latitude: 28.6,
      longitude: 185,
    });
    expect(result.success).toBe(false);
  });
});

describe("correctAttendanceSchema", () => {
  it("accepts a valid correction", () => {
    const result = correctAttendanceSchema.safeParse({
      eventId: "aaaaaaaa-0000-4000-8000-000000000001",
      profileId: "bbbbbbbb-0000-4000-8000-000000000001",
      status: "present",
      reason: "GPS unavailable at venue",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a reason shorter than 3 characters", () => {
    const result = correctAttendanceSchema.safeParse({
      eventId: "aaaaaaaa-0000-4000-8000-000000000001",
      profileId: "bbbbbbbb-0000-4000-8000-000000000001",
      status: "present",
      reason: "ok",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid status", () => {
    const result = correctAttendanceSchema.safeParse({
      eventId: "aaaaaaaa-0000-4000-8000-000000000001",
      profileId: "bbbbbbbb-0000-4000-8000-000000000001",
      status: "maybe",
      reason: "Legit reason here",
    });
    expect(result.success).toBe(false);
  });
});

describe("createEventSchema", () => {
  it("accepts a valid event", () => {
    const result = createEventSchema.safeParse({
      name: "Annual Day",
      eventDate: "2026-03-15",
      status: "upcoming",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid date", () => {
    const result = createEventSchema.safeParse({
      name: "Annual Day",
      eventDate: "not-a-date",
      status: "upcoming",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid status", () => {
    const result = createEventSchema.safeParse({
      name: "Annual Day",
      eventDate: "2026-03-15",
      status: "planning",
    });
    expect(result.success).toBe(false);
  });
});

describe("createAnnouncementSchema", () => {
  it("accepts a valid announcement", () => {
    const result = createAnnouncementSchema.safeParse({
      title: "Rehearsal moved",
      message: "Rehearsal is now at 4pm in Hall B.",
      priority: "important",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty message", () => {
    const result = createAnnouncementSchema.safeParse({
      title: "Test",
      message: "",
      priority: "normal",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid priority", () => {
    const result = createAnnouncementSchema.safeParse({
      title: "Test",
      message: "Hello",
      priority: "critical",
    });
    expect(result.success).toBe(false);
  });
});

describe("updateProfileSchema", () => {
  it("accepts a valid name with an avatar url", () => {
    const result = updateProfileSchema.safeParse({
      fullName: "Ada Lovelace",
      avatarUrl: "https://example.com/avatar.png",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a null avatar url", () => {
    const result = updateProfileSchema.safeParse({
      fullName: "Ada Lovelace",
      avatarUrl: null,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a name shorter than 2 characters once trimmed", () => {
    const result = updateProfileSchema.safeParse({ fullName: "  A  " });
    expect(result.success).toBe(false);
  });

  it("strips control characters from the name", () => {
    const result = updateProfileSchema.safeParse({ fullName: "Ada\u0007 Lovelace" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.fullName).toBe("Ada Lovelace");
    }
  });

  it("rejects an invalid avatar url", () => {
    const result = updateProfileSchema.safeParse({
      fullName: "Ada Lovelace",
      avatarUrl: "not-a-url",
    });
    expect(result.success).toBe(false);
  });
});

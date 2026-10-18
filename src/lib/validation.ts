import { z } from "zod";
import {
  ROLES,
  SCRIPT_STATUSES,
  SCRIPT_CATEGORIES,
  EVENT_STATUSES,
  ANNOUNCEMENT_PRIORITIES,
} from "@/types/database";

/** Strip ASCII control characters and trim — used for all free-text input. */
const CONTROL_CHARS = /[\\u0000-\\u001F\\u007F]/g;

const safeText = (max: number) =>
  z
    .string()
    .max(max, `Must be at most ${max} characters`)
    .transform((s) => s.replace(CONTROL_CHARS, "").trim());

const optionalText = (max: number) =>
  z
    .string()
    .max(max)
    .optional()
    .nullable()
    .transform((s) => (s ? s.replace(CONTROL_CHARS, "").trim() || null : null));

// ---------------- Auth ----------------

export const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().email("Enter a valid email address"),
});

export const resetPasswordSchema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const acceptInviteSchema = z.object({
  token: z.string().min(10),
  fullName: safeText(120).refine((s) => s.length >= 2, "Name must be at least 2 characters"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

// ---------------- Team invites ----------------

export const createInviteSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  fullName: safeText(120).refine((s) => s.length >= 2, "Name must be at least 2 characters"),
  role: z.enum(ROLES),
});

export const revokeInviteSchema = z.object({
  inviteId: z.string().uuid(),
});

// ---------------- Scripts ----------------

const tipTapDoc = z
  .object({
    type: z.literal("doc"),
    content: z.array(z.unknown()).optional(),
  })
  .passthrough()
  .nullable();

export const createScriptSchema = z.object({
  title: safeText(200).refine((s) => s.length >= 2, "Title must be at least 2 characters"),
  eventId: z.string().uuid().nullable().optional(),
  category: z.enum(SCRIPT_CATEGORIES),
  assignedTo: z.array(z.string().uuid()).max(20).optional().default([]),
  deadline: z.string().date().nullable().optional(),
});
export type CreateScriptInput = z.infer<typeof createScriptSchema>;

export const saveScriptSchema = z.object({
  scriptId: z.string().uuid(),
  baseRevision: z.number().int().positive(),
  title: safeText(200).refine((s) => s.length >= 2, "Title must be at least 2 characters"),
  content: tipTapDoc,
  status: z.enum(SCRIPT_STATUSES),
  note: optionalText(300),
  force: z.boolean().optional().default(false),
});
export type SaveScriptInput = z.infer<typeof saveScriptSchema>;

export const restoreVersionSchema = z.object({
  scriptId: z.string().uuid(),
  versionId: z.string().uuid(),
});

// ---------------- Script comments ----------------

export const createCommentSchema = z.object({
  scriptId: z.string().uuid(),
  body: safeText(4000).refine((s) => s.length >= 1, "Comment cannot be empty"),
});

export const deleteCommentSchema = z.object({
  commentId: z.string().uuid(),
});

// ---------------- Events ----------------

export const createEventSchema = z.object({
  name: safeText(160).refine((s) => s.length >= 2, "Name must be at least 2 characters"),
  description: optionalText(4000),
  eventDate: z.string().date("Pick a valid date"),
  startTime: z
    .string()
    .regex(/^\\d{2}:\\d{2}$/)
    .nullable()
    .optional(),
  endTime: z
    .string()
    .regex(/^\\d{2}:\\d{2}$/)
    .nullable()
    .optional(),
  venue: optionalText(200),
  status: z.enum(EVENT_STATUSES),
  notes: optionalText(8000),
});
export type CreateEventInput = z.infer<typeof createEventSchema>;

export const updateEventSchema = createEventSchema.extend({
  eventId: z.string().uuid(),
});

export const attendanceConfigSchema = z.object({
  eventId: z.string().uuid(),
  attendanceEnabled: z.boolean(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  geofenceRadiusM: z.number().int().min(10).max(10000).nullable().optional(),
  checkInOpensAt: z.string().nullable().optional(),
  checkInClosesAt: z.string().nullable().optional(),
});

export const setAssignmentsSchema = z.object({
  eventId: z.string().uuid(),
  assignments: z
    .array(
      z.object({
        profileId: z.string().uuid(),
        responsibility: optionalText(160),
      })
    )
    .max(30),
});

// ---------------- Run of show ----------------

export const runOfShowItemSchema = z.object({
  eventId: z.string().uuid(),
  itemId: z.string().uuid().optional().nullable(),
  startTime: z
    .string()
    .regex(/^\\d{2}:\\d{2}$/)
    .nullable()
    .optional(),
  segmentTitle: safeText(160).refine((s) => s.length >= 1, "Segment title is required"),
  description: optionalText(4000),
  assignedTo: z.string().uuid().nullable().optional(),
  scriptId: z.string().uuid().nullable().optional(),
  stageCue: optionalText(2000),
  notes: optionalText(4000),
});
export type RunOfShowItemInput = z.infer<typeof runOfShowItemSchema>;

export const reorderRunOfShowSchema = z.object({
  eventId: z.string().uuid(),
  orderedItemIds: z.array(z.string().uuid()).min(1),
});

// ---------------- Announcements ----------------

export const createAnnouncementSchema = z.object({
  title: safeText(160).refine((s) => s.length >= 2, "Title must be at least 2 characters"),
  message: safeText(8000).refine((s) => s.length >= 1, "Message cannot be empty"),
  priority: z.enum(ANNOUNCEMENT_PRIORITIES),
});

export const acknowledgeSchema = z.object({
  announcementId: z.string().uuid(),
});

// ---------------- Attendance ----------------

export const checkInSchema = z.object({
  eventId: z.string().uuid(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export const correctAttendanceSchema = z.object({
  eventId: z.string().uuid(),
  profileId: z.string().uuid(),
  status: z.enum(["present", "absent", "excused"]),
  reason: safeText(500).refine((s) => s.length >= 3, "Please provide a reason"),
});

// ---------------- Profile ----------------

export const updateProfileSchema = z.object({
  fullName: safeText(120).refine((s) => s.length >= 2, "Name must be at least 2 characters"),
  avatarUrl: z.string().url().nullable().optional(),
});

export const updateMemberRoleSchema = z.object({
  profileId: z.string().uuid(),
  role: z.enum(ROLES),
  status: z.enum(["active", "suspended"]),
});

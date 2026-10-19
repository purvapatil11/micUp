"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser, requireOfficer } from "@/lib/auth";
import {
  createEventSchema,
  updateEventSchema,
  setAssignmentsSchema,
  attendanceConfigSchema,
} from "@/lib/validation";
import type { ActionResult } from "@/actions/auth";

export async function createEventAction(input: {
  name: string;
  description?: string | null;
  eventDate: string;
  startTime?: string | null;
  endTime?: string | null;
  venue?: string | null;
  status: string;
  notes?: string | null;
}): Promise<ActionResult & { id?: string }> {
  try {
    const user = await requireOfficer();
    const parsed = createEventSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("events")
      .insert({
        name: parsed.data.name,
        description: parsed.data.description,
        event_date: parsed.data.eventDate,
        start_time: parsed.data.startTime,
        end_time: parsed.data.endTime,
        venue: parsed.data.venue,
        status: parsed.data.status,
        notes: parsed.data.notes,
      })
      .select("id")
      .single();

    if (error) return { ok: false, error: error.message };

    revalidatePath("/events");
    revalidatePath("/dashboard");
    return { ok: true, id: data.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to create event." };
  }
}

export async function updateEventAction(input: {
  eventId: string;
  name: string;
  description?: string | null;
  eventDate: string;
  startTime?: string | null;
  endTime?: string | null;
  venue?: string | null;
  status: string;
  notes?: string | null;
}): Promise<ActionResult> {
  try {
    await requireOfficer();
    const parsed = updateEventSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from("events")
      .update({
        name: parsed.data.name,
        description: parsed.data.description,
        event_date: parsed.data.eventDate,
        start_time: parsed.data.startTime,
        end_time: parsed.data.endTime,
        venue: parsed.data.venue,
        status: parsed.data.status,
        notes: parsed.data.notes,
      })
      .eq("id", parsed.data.eventId);

    if (error) return { ok: false, error: error.message };

    revalidatePath(`/events/${parsed.data.eventId}`);
    revalidatePath("/events");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to update event." };
  }
}

export async function setEventAssignmentsAction(input: {
  eventId: string;
  assignments: Array<{ profileId: string; responsibility?: string | null }>;
}): Promise<ActionResult> {
  try {
    await requireOfficer();
    const parsed = setAssignmentsSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
    }

    const supabase = await createClient();
    await supabase.from("event_assignments").delete().eq("event_id", parsed.data.eventId);

    if (parsed.data.assignments.length > 0) {
      const { error } = await supabase.from("event_assignments").insert(
        parsed.data.assignments.map((a) => ({
          event_id: parsed.data.eventId,
          profile_id: a.profileId,
          responsibility: a.responsibility ?? null,
        }))
      );
      if (error) return { ok: false, error: error.message };
    }

    revalidatePath(`/events/${parsed.data.eventId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to set assignments." };
  }
}

export async function updateAttendanceConfigAction(input: {
  eventId: string;
  attendanceEnabled: boolean;
  latitude?: number | null;
  longitude?: number | null;
  geofenceRadiusM?: number | null;
  checkInOpensAt?: string | null;
  checkInClosesAt?: string | null;
}): Promise<ActionResult> {
  try {
    await requireOfficer();
    const parsed = attendanceConfigSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from("events")
      .update({
        attendance_enabled: parsed.data.attendanceEnabled,
        latitude: parsed.data.latitude,
        longitude: parsed.data.longitude,
        geofence_radius_m: parsed.data.geofenceRadiusM,
        check_in_opens_at: parsed.data.checkInOpensAt,
        check_in_closes_at: parsed.data.checkInClosesAt,
      })
      .eq("id", parsed.data.eventId);

    if (error) return { ok: false, error: error.message };

    revalidatePath(`/events/${parsed.data.eventId}`);
    revalidatePath(`/events/${parsed.data.eventId}/attendance`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to update attendance config." };
  }
}

export async function deleteEventAction(input: { eventId: string }): Promise<ActionResult> {
  try {
    await requireOfficer();
    const supabase = await createClient();
    const { error } = await supabase.from("events").delete().eq("id", input.eventId);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/events");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to delete event." };
  }
}

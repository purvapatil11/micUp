"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOfficer } from "@/lib/auth";
import { checkInSchema, correctAttendanceSchema } from "@/lib/validation";
import type { ActionResult } from "@/actions/auth";

export interface CheckInResult extends ActionResult {
  distanceM?: number;
  radiusM?: number;
  checkedInAt?: string;
}

export async function checkInAction(input: {
  eventId: string;
  latitude: number;
  longitude: number;
}): Promise<CheckInResult> {
  try {
    const parsed = checkInSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid coordinates." };
    }

    const supabase = await createClient();
    const { data, error } = await supabase.rpc("fn_check_in", {
      p_event_id: parsed.data.eventId,
      p_latitude: parsed.data.latitude,
      p_longitude: parsed.data.longitude,
    });

    if (error) return { ok: false, error: error.message };

    const payload = data as any;
    if (payload?.outcome !== "ok") {
      return { ok: false, error: "Check-in failed." };
    }

    revalidatePath(`/events/${parsed.data.eventId}/attendance`);
    revalidatePath("/dashboard");
    return {
      ok: true,
      distanceM: payload.distance_m,
      radiusM: payload.radius_m,
      checkedInAt: payload.checked_in_at,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to check in." };
  }
}

export async function correctAttendanceAction(input: {
  eventId: string;
  profileId: string;
  status: string;
  reason: string;
}): Promise<ActionResult> {
  try {
    await requireOfficer();
    const parsed = correctAttendanceSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
    }

    const supabase = await createClient();
    const { error } = await supabase.rpc("fn_correct_attendance", {
      p_event_id: parsed.data.eventId,
      p_profile_id: parsed.data.profileId,
      p_status: parsed.data.status,
      p_reason: parsed.data.reason,
    });

    if (error) return { ok: false, error: error.message };

    revalidatePath(`/events/${parsed.data.eventId}/attendance`);
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to correct attendance." };
  }
}

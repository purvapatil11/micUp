"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOfficer, requireUser } from "@/lib/auth";
import { createAnnouncementSchema, acknowledgeSchema } from "@/lib/validation";
import type { ActionResult } from "@/actions/auth";

export async function createAnnouncementAction(input: {
  title: string;
  message: string;
  priority: string;
}): Promise<ActionResult & { id?: string }> {
  try {
    await requireOfficer();
    const parsed = createAnnouncementSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("announcements")
      .insert({
        title: parsed.data.title,
        message: parsed.data.message,
        priority: parsed.data.priority,
      })
      .select("id")
      .single();

    if (error) return { ok: false, error: error.message };

    revalidatePath("/announcements");
    revalidatePath("/dashboard");
    return { ok: true, id: data.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to publish announcement." };
  }
}

export async function acknowledgeAnnouncementAction(input: {
  announcementId: string;
}): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const parsed = acknowledgeSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Invalid announcement." };

    const supabase = await createClient();
    const { error } = await supabase
      .from("announcement_acknowledgements")
      .insert({ announcement_id: parsed.data.announcementId, profile_id: user.id })
      .select("id")
      .single();

    // Unique violation: already acknowledged — treat as success.
    if (error && error.code !== "23505") {
      return { ok: false, error: error.message };
    }

    revalidatePath("/announcements");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to acknowledge." };
  }
}

export async function deleteAnnouncementAction(input: { announcementId: string }): Promise<ActionResult> {
  try {
    await requireOfficer();
    const supabase = await createClient();
    const { error } = await supabase
      .from("announcements")
      .delete()
      .eq("id", input.announcementId);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/announcements");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to delete announcement." };
  }
}

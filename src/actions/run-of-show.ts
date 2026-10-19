"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOfficer } from "@/lib/auth";
import { runOfShowItemSchema, reorderRunOfShowSchema } from "@/lib/validation";
import type { ActionResult } from "@/actions/auth";

export async function upsertRunOfShowItemAction(input: {
  eventId: string;
  itemId?: string | null;
  startTime?: string | null;
  segmentTitle: string;
  description?: string | null;
  assignedTo?: string | null;
  scriptId?: string | null;
  stageCue?: string | null;
  notes?: string | null;
}): Promise<ActionResult & { id?: string }> {
  try {
    await requireOfficer();
    const parsed = runOfShowItemSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
    }

    const supabase = await createClient();

    // If creating new, determine next sequence.
    let sequence = 1;
    if (!parsed.data.itemId) {
      const { data: last } = await supabase
        .from("run_of_show_items")
        .select("sequence")
        .eq("event_id", parsed.data.eventId)
        .order("sequence", { ascending: false })
        .limit(1)
        .maybeSingle();
      sequence = last ? last.sequence + 1 : 1;
    }

    const payload = {
      event_id: parsed.data.eventId,
      start_time: parsed.data.startTime,
      segment_title: parsed.data.segmentTitle,
      description: parsed.data.description,
      assigned_to: parsed.data.assignedTo,
      script_id: parsed.data.scriptId,
      stage_cue: parsed.data.stageCue,
      notes: parsed.data.notes,
    };

    let result;
    if (parsed.data.itemId) {
      result = await supabase
        .from("run_of_show_items")
        .update(payload)
        .eq("id", parsed.data.itemId)
        .select("id")
        .single();
    } else {
      result = await supabase
        .from("run_of_show_items")
        .insert({ ...payload, sequence })
        .select("id")
        .single();
    }

    if (result.error) return { ok: false, error: result.error.message };

    revalidatePath(`/events/${parsed.data.eventId}/run-of-show`);
    revalidatePath(`/run-of-show`);
    return { ok: true, id: result.data.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to save item." };
  }
}

export async function deleteRunOfShowItemAction(input: {
  eventId: string;
  itemId: string;
}): Promise<ActionResult> {
  try {
    await requireOfficer();
    const supabase = await createClient();
    const { error } = await supabase.from("run_of_show_items").delete().eq("id", input.itemId).eq("event_id", input.eventId);
    if (error) return { ok: false, error: error.message };
    revalidatePath(`/events/${input.eventId}/run-of-show`);
    revalidatePath(`/run-of-show`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to delete item." };
  }
}

export async function reorderRunOfShowAction(input: {
  eventId: string;
  orderedItemIds: string[];
}): Promise<ActionResult> {
  try {
    await requireOfficer();
    const parsed = reorderRunOfShowSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Invalid input." };

    const supabase = await createClient();
    // Update each item's sequence
    const updates = parsed.data.orderedItemIds.map((id, idx) =>
      supabase
        .from("run_of_show_items")
        .update({ sequence: idx + 1 })
        .eq("id", id)
        .eq("event_id", parsed.data.eventId)
    );
    const results = await Promise.all(updates);
    const firstErr = results.find((r) => r.error);
    if (firstErr) return { ok: false, error: firstErr.error?.message ?? "Failed to reorder." };

    revalidatePath(`/events/${parsed.data.eventId}/run-of-show`);
    revalidatePath(`/run-of-show`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to reorder." };
  }
}

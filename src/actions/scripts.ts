"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser, requireOfficer } from "@/lib/auth";
import { authorizeScriptStatusChange } from "@/lib/permissions";
import {
  createScriptSchema,
  saveScriptSchema,
  restoreVersionSchema,
} from "@/lib/validation";
import type { ActionResult } from "@/actions/auth";
import type { TipTapDoc } from "@/types/database";

export async function createScriptAction(input: {
  title: string;
  eventId?: string | null;
  category: string;
  assignedTo?: string[];
  deadline?: string | null;
}): Promise<ActionResult & { id?: string }> {
  try {
    const user = await requireUser();
    const parsed = createScriptSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("scripts")
      .insert({
        title: parsed.data.title,
        event_id: parsed.data.eventId ?? null,
        category: parsed.data.category,
        assigned_to: parsed.data.assignedTo ?? [],
        content: null,
        status: "draft",
      })
      .select("id")
      .single();

    if (error) return { ok: false, error: error.message };

    revalidatePath("/scripts");
    revalidatePath("/dashboard");
    return { ok: true, id: data.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to create script." };
  }
}

export async function saveScriptAction(
  input: {
    scriptId: string;
    baseRevision: number;
    title: string;
    content: TipTapDoc | null;
    status: string;
    assignedTo?: string[];
    eventId?: string | null;
    category?: string;
    deadline?: string | null;
    note?: string | null;
  },
  options?: { force?: boolean }
): Promise<ActionResult & { revision?: number; updatedAt?: string }> {
  try {
    const user = await requireUser();
    const parsed = saveScriptSchema.safeParse({
      scriptId: input.scriptId,
      baseRevision: input.baseRevision,
      title: input.title,
      content: input.content,
      status: input.status,
      note: input.note,
      force: options?.force ?? false,
    });
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
    }

    const { data: current } = await (await createClient())
      .from("scripts")
      .select("status, content, title")
      .eq("id", parsed.data.scriptId)
      .single();

    const contentChanged = Boolean(
      current && (JSON.stringify(current.content) !== JSON.stringify(parsed.data.content) || current.title !== parsed.data.title)
    );
    const rule = authorizeScriptStatusChange({
      actorRole: user.profile.role,
      currentStatus: (current?.status ?? "draft") as any,
      nextStatus: parsed.data.status as any,
      contentChanged,
    });
    if (!rule.ok) {
      return { ok: false, error: rule.message };
    }

    const supabase = await createClient();
    const { data, error } = await supabase.rpc("fn_save_script", {
      p_script_id: parsed.data.scriptId,
      p_base_revision: parsed.data.baseRevision,
      p_title: parsed.data.title,
      p_content: parsed.data.content,
      p_status: parsed.data.status,
      p_assigned_to: input.assignedTo ?? null,
      p_event_id: input.eventId ?? null,
      p_category: input.category ?? null,
      p_deadline: input.deadline ?? null,
      p_note: parsed.data.note,
      p_force: options?.force ?? false,
    });

    if (error) return { ok: false, error: error.message };
    if (!data) return { ok: false, error: "Save failed." };

    const outcome = (data as any).outcome;
    if (outcome === "conflict") {
      return {
        ok: false,
        error: `Conflict: someone else saved revision ${(data as any).current_revision}. Reload and merge your changes.`,
      };
    }
    if (outcome !== "ok") {
      return { ok: false, error: "Save failed." };
    }

    revalidatePath(`/scripts/${parsed.data.scriptId}`);
    revalidatePath("/scripts");
    revalidatePath("/dashboard");
    return {
      ok: true,
      revision: (data as any).revision,
      updatedAt: (data as any).updated_at,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to save script." };
  }
}

export async function restoreScriptVersionAction(input: {
  scriptId: string;
  versionId: string;
}): Promise<ActionResult> {
  try {
    await requireOfficer();
    const parsed = restoreVersionSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: "Invalid input." };
    }

    const supabase = await createClient();
    const { error } = await supabase.rpc("fn_restore_script_revision", {
      p_script_id: parsed.data.scriptId,
      p_version_id: parsed.data.versionId,
    });

    if (error) return { ok: false, error: error.message };

    revalidatePath(`/scripts/${parsed.data.scriptId}`);
    revalidatePath("/scripts");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to restore version." };
  }
}

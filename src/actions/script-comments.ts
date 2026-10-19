"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { createCommentSchema, deleteCommentSchema } from "@/lib/validation";
import type { ActionResult } from "@/actions/auth";

export async function createCommentAction(input: {
  scriptId: string;
  body: string;
}): Promise<ActionResult & { id?: string }> {
  try {
    const user = await requireUser();
    const parsed = createCommentSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("script_comments")
      .insert({ script_id: parsed.data.scriptId, body: parsed.data.body })
      .select("id")
      .single();

    if (error) return { ok: false, error: error.message };

    revalidatePath(`/scripts/${parsed.data.scriptId}`);
    revalidatePath("/dashboard");
    return { ok: true, id: data.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to post comment." };
  }
}

export async function deleteCommentAction(input: {
  commentId: string;
}): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const parsed = deleteCommentSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Invalid comment." };

    const supabase = await createClient();
    const { data: comment } = await supabase
      .from("script_comments")
      .select("script_id, author_id")
      .eq("id", parsed.data.commentId)
      .single();

    if (!comment) return { ok: false, error: "Comment not found." };

    const isOwner = comment.author_id === user.id;
    const isOfficer = ["anchoring_officer", "deputy_anchoring_officer"].includes(
      user.profile.role
    );
    if (!isOwner && !isOfficer) {
      return { ok: false, error: "Not authorized to delete this comment." };
    }

    const { error } = await supabase
      .from("script_comments")
      .delete()
      .eq("id", parsed.data.commentId);

    if (error) return { ok: false, error: error.message };

    revalidatePath(`/scripts/${comment.script_id}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to delete comment." };
  }
}

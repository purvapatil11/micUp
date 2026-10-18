"use server";

import { randomBytes, createHash } from "crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, hasServiceRoleClient } from "@/lib/supabase/admin";
import { requireOfficer, requireUser } from "@/lib/auth";
import { isOfficer } from "@/lib/permissions";
import {
  createInviteSchema,
  revokeInviteSchema,
  acceptInviteSchema,
  updateProfileSchema,
  updateMemberRoleSchema,
} from "@/lib/validation";
import type { ActionResult } from "@/actions/auth";
import type { Role } from "@/types/database";

const INVITE_TTL_DAYS = 7;

export interface InviteResult {
  ok: boolean;
  error?: string;
  inviteId?: string;
  /** Raw token — only returned once, to be shared with the invitee. */
  token?: string;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Officer-only: creates an invite. The invited auth user is created later
 * when the invitee sets their password (public signup stays disabled).
 */
export async function createInviteAction(input: {
  email: string;
  fullName: string;
  role: Role;
}): Promise<InviteResult> {
  try {
    const user = await requireOfficer();
    const parsed = createInviteSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
    }

    const supabase = await createClient();

    // Reject invites for people who already have a profile.
    const { data: existing } = await supabase
      .from("profiles")
      .select("id, status")
      .ilike("email", parsed.data.email)
      .maybeSingle();

    if (existing) {
      return {
        ok: false,
        error:
          existing.status === "active"
            ? "That person is already on the team."
            : "A profile already exists for that email. It is probably still pending — approve it from the Team page or ask them to complete their invite.",
      };
    }

    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(
      Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000
    ).toISOString();

    const { data, error } = await supabase
      .from("team_invites")
      .insert({
        email: parsed.data.email.toLowerCase(),
        full_name: parsed.data.fullName,
        role: parsed.data.role,
        token_hash: hashToken(token),
        expires_at: expiresAt,
        created_by: user.id,
      })
      .select("id")
      .single();

    if (error) {
      if (error.code === "23505") {
        return { ok: false, error: "A pending invite already exists for that email." };
      }
      return { ok: false, error: error.message };
    }

    revalidatePath("/team");
    return { ok: true, inviteId: data.id, token };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to create invite." };
  }
}

export async function revokeInviteAction(input: { inviteId: string }): Promise<ActionResult> {
  try {
    await requireOfficer();
    const parsed = revokeInviteSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Invalid invite." };

    const supabase = await createClient();
    const { error } = await supabase
      .from("team_invites")
      .update({ status: "revoked" })
      .eq("id", parsed.data.inviteId)
      .eq("status", "pending");

    if (error) return { ok: false, error: error.message };
    revalidatePath("/team");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to revoke invite." };
  }
}

/**
 * Invitee flow: sets password, creates the auth user (service role, since
 * public signup is disabled) and activates the profile in one step.
 */
export async function acceptInviteAction(input: {
  token: string;
  fullName: string;
  password: string;
}): Promise<ActionResult & { email?: string }> {
  try {
    const parsed = acceptInviteSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
    }

    if (!hasServiceRoleClient()) {
      return {
        ok: false,
        error:
          "Server is missing SUPABASE_SERVICE_ROLE_KEY, so invites cannot be completed yet. Ask your administrator to configure it.",
      };
    }

    // Look up the invite with the anon client — but the table has no public
    // read policy, so use the admin client for the lookup instead.
    const admin = createAdminClient();
    const tokenHash = hashToken(parsed.data.token);

    const { data: invite, error: inviteError } = await admin
      .from("team_invites")
      .select("id, email, full_name, role, status, expires_at")
      .eq("token_hash", tokenHash)
      .single();

    if (inviteError || !invite) {
      return { ok: false, error: "This invite link is not valid." };
    }
    if (invite.status !== "pending") {
      return { ok: false, error: `This invite was already ${invite.status}.` };
    }
    if (new Date(invite.expires_at) < new Date()) {
      await admin.from("team_invites").update({ status: "expired" }).eq("id", invite.id);
      return { ok: false, error: "This invite has expired. Ask an officer for a new one." };
    }

    // Create the auth user (confirmed immediately — the invite is the approval).
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: invite.email,
      password: parsed.data.password,
      email_confirm: true,
      user_metadata: { invited_via: "micup" },
    });

    if (createError || !created.user) {
      const msg = createError?.message ?? "Could not create the account.";
      if (msg.toLowerCase().includes("already")) {
        return {
          ok: false,
          error: "An account with that email already exists. Ask an officer for help signing in.",
        };
      }
      return { ok: false, error: msg };
    }

    const { error: profileError } = await admin.from("profiles").insert({
      id: created.user.id,
      full_name: parsed.data.fullName || invite.full_name,
      email: invite.email.toLowerCase(),
      role: invite.role satisfies Role,
      status: "active",
    });

    if (profileError) {
      // Best effort: remove the orphaned auth user.
      await admin.auth.admin.deleteUser(created.user.id).catch(() => undefined);
      return { ok: false, error: profileError.message };
    }

    await admin
      .from("team_invites")
      .update({ status: "accepted" })
      .eq("id", invite.id);

    return { ok: true, email: invite.email };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to accept invite." };
  }
}

export async function updateOwnProfileAction(input: {
  fullName: string;
  avatarUrl?: string | null;
}): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const parsed = updateProfileSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: parsed.data.fullName,
        avatar_url: parsed.data.avatarUrl ?? null,
      })
      .eq("id", user.id);

    if (error) return { ok: false, error: error.message };
    revalidatePath("/settings");
    revalidatePath("/team");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to update profile." };
  }
}

export async function updateMemberRoleAction(input: {
  profileId: string;
  role: Role;
  status: "active" | "suspended";
}): Promise<ActionResult> {
  try {
    const user = await requireOfficer();
    const parsed = updateMemberRoleSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Invalid input." };

    if (parsed.data.profileId === user.id) {
      return { ok: false, error: "You cannot change your own role or status." };
    }

    // Only the Anchoring Officer may assign the Anchoring Officer role,
    // and no one may promote above their own authority level.
    if (parsed.data.role === "anchoring_officer" && user.profile.role !== "anchoring_officer") {
      return {
        ok: false,
        error: "Only the Anchoring Officer can appoint another Anchoring Officer.",
      };
    }
    if (
      isOfficer(parsed.data.role) &&
      !isOfficer(user.profile.role)
    ) {
      return { ok: false, error: "Not authorized." };
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from("profiles")
      .update({ role: parsed.data.role, status: parsed.data.status })
      .eq("id", parsed.data.profileId);

    if (error) return { ok: false, error: error.message };
    revalidatePath("/team");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to update member." };
  }
}

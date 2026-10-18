import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isOfficer } from "@/lib/permissions";
import type { Profile, Role } from "@/types/database";

export interface SessionUser {
  id: string;
  email: string;
  profile: Profile;
}

/**
 * Resolves the authenticated user together with their approved profile.
 * Returns null when there is no session OR the profile is not approved —
 * an auth session alone never grants access to workspace data.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id || !user.email) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile || profile.status !== "active") return null;

  return { id: user.id, email: user.email, profile: profile as Profile };
});

/** For protected app pages: redirects to login when unauthenticated,
 *  and to a pending page when the account is not yet approved. */
export async function requireUser(): Promise<SessionUser> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/pending");
  if (profile.status === "suspended") redirect("/suspended");
  if (profile.status !== "active") redirect("/pending");

  return { id: user.id, email: user.email ?? "", profile: profile as Profile };
}

export async function requireOfficer(): Promise<SessionUser> {
  const user = await requireUser();
  if (!isOfficer(user.profile.role)) {
    throw new Error("Only Anchoring Officers or Deputies can perform this action.");
  }
  return user;
}

export async function getActiveMembers(): Promise<Profile[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, status, avatar_url, created_at, updated_at")
    .eq("status", "active")
    .order("full_name");
  if (error) throw new Error(error.message);
  return data as Profile[];
}

export function roleOf(user: SessionUser): Role {
  return user.profile.role;
}

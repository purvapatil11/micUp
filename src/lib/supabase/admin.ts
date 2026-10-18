import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getPublicEnv, getServiceRoleKey } from "@/lib/env";

/**
 * Service-role client for trusted server-side operations only
 * (creating invited auth users, administrative attendance corrections).
 *
 * This module imports `server-only` so a bundling mistake that pulls it into
 * client code fails the build immediately.
 */
export function hasServiceRoleClient(): boolean {
  return getServiceRoleKey() !== null;
}

export function createAdminClient() {
  const key = getServiceRoleKey();
  if (!key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not configured. Add it to your environment to use administrative features (invites, attendance corrections)."
    );
  }
  const { NEXT_PUBLIC_SUPABASE_URL } = getPublicEnv();
  return createSupabaseClient(NEXT_PUBLIC_SUPABASE_URL, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

import { z } from "zod";

/**
 * Environment validation.
 *
 * NEXT_PUBLIC_* values are inlined at build time by Next.js. They are still
 * validated here so misconfiguration fails loudly on the server instead of
 * producing confusing runtime errors.
 */

const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z
    .string()
    .url("NEXT_PUBLIC_SUPABASE_URL must be a valid URL"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z
    .string()
    .min(1, "NEXT_PUBLIC_SUPABASE_ANON_KEY is required"),
});

const serverEnvSchema = publicEnvSchema.extend({
  /**
   * Service-role key. Server-only — never exposed to the browser.
   * Required for the invite workflow (creating invited auth users) and
   * administrative attendance corrections that bypass RLS intentionally.
   */
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;

function readPublicEnv(): PublicEnv {
  return {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  };
}

export function isSupabaseConfigured(): boolean {
  const result = publicEnvSchema.safeParse(readPublicEnv());
  return result.success;
}

export function getPublicEnv(): PublicEnv {
  const parsed = publicEnvSchema.safeParse(readPublicEnv());
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    throw new Error(`Missing/invalid environment variables — ${issues}`);
  }
  return parsed.data;
}

export function getServerEnv() {
  const parsed = serverEnvSchema.safeParse({
    ...readPublicEnv(),
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    throw new Error(`Missing/invalid environment variables — ${issues}`);
  }
  return parsed.data;
}

export function getServiceRoleKey(): string | null {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return key && key.length > 0 ? key : null;
}

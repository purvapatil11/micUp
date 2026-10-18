import type { Metadata } from "next";
import { MicUpLogo } from "@/components/logo";

export const metadata: Metadata = { title: "Sign in" };

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10">
      {/* Subtle stage-light glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(60%_50%_at_50%_0%,color-mix(in_srgb,var(--primary)_10%,transparent),transparent)]"
      />
      <div className="relative z-10 w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <MicUpLogo size={36} />
        </div>
        {children}
        <p className="mt-8 text-center text-xs text-muted-foreground">
          Private workspace · Invite only
        </p>
      </div>
    </div>
  );
}

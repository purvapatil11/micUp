import type { Metadata } from "next";
import { MicUpLogo } from "@/components/logo";

export const metadata: Metadata = { title: "Sign in" };

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="tf-scope relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-4 py-10">
      <div className="relative z-10 w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <MicUpLogo size={56} />
        </div>
        {children}
        <p className="mt-8 text-center text-xs font-medium text-muted-foreground">
          Private workspace · Invite only
        </p>
      </div>
    </div>
  );
}

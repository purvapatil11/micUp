import type { Metadata } from "next";
import Image from "next/image";
import { MicUpLogo } from "@/components/logo";

export const metadata: Metadata = { title: "Sign in" };

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="tf-scope relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-4 py-10">
      {/* Halftone dot band across the top */}
      <Image
        src="/techfiesta/dot-overlay.png"
        alt=""
        aria-hidden
        width={1440}
        height={744}
        className="pointer-events-none absolute inset-x-0 top-0 h-32 w-full select-none object-cover opacity-80 sm:h-44"
        priority
      />

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

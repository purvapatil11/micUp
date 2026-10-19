import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Geist_Mono, Pixelify_Sans, Space_Grotesk } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const pixelifySans = Pixelify_Sans({
  variable: "--font-pixelify",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "MicUp",
    template: "%s · MicUp",
  },
  description:
    "Private anchoring team coordination — scripts, events, run of show and event-day attendance in one backstage workspace.",
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${pixelifySans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="tf-scope min-h-full bg-background font-sans text-foreground">
        {children}
        <Toaster position="bottom-right" richColors closeButton />
      </body>
    </html>
  );
}

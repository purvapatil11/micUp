"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requestPasswordResetAction } from "@/actions/auth";

export default function ForgotPasswordPage() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const email = String(new FormData(e.currentTarget).get("email") ?? "");

    startTransition(async () => {
      const result = await requestPasswordResetAction({ email });
      if (!result.ok) {
        setError(result.error ?? "Could not send the reset link.");
        return;
      }
      setSent(true);
      toast.success("Reset link sent");
    });
  }

  return (
    <Card className="border-border bg-card/80 backdrop-blur">
      <CardHeader>
        <CardTitle>Reset password</CardTitle>
        <CardDescription>
          We&apos;ll email you a secure link to set a new password.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {sent ? (
          <div className="space-y-4 text-sm text-muted-foreground">
            <p>
              If an account exists for that address, a reset link is on its way.
              Check your inbox and follow the link to choose a new password.
            </p>
            <Button asChild variant="outline" className="w-full">
              <Link href="/login">Back to sign in</Link>
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                placeholder="you@college.edu"
                disabled={pending}
              />
            </div>
            {error ? (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            ) : null}
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : null}
              {pending ? "Sending…" : "Send reset link"}
            </Button>
            <p className="text-center text-xs">
              <Link href="/login" className="text-muted-foreground hover:text-foreground">
                Back to sign in
              </Link>
            </p>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { acceptInviteAction } from "@/actions/team";
import { ROLE_LABELS, type Role } from "@/types/database";

export function AcceptInviteForm({
  token,
  email,
  fullName,
  roleLabel,
}: {
  token: string;
  email: string;
  fullName: string;
  roleLabel: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    const name = String(form.get("fullName") ?? "");
    const password = String(form.get("password") ?? "");
    const confirm = String(form.get("confirmPassword") ?? "");

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    startTransition(async () => {
      const result = await acceptInviteAction({ token, fullName: name, password });
      if (!result.ok) {
        setError(result.error ?? "Could not complete the invite.");
        return;
      }
      toast.success("Account created — signing you in");
      // Sign the new user in with the password they just set.
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: result.email ?? email,
        password,
      });
      if (signInError) {
        router.push("/login");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    });
  }

  return (
    <Card className="border-border bg-card/80 backdrop-blur">
      <CardHeader>
        <CardTitle>Join MicUp</CardTitle>
        <CardDescription>
          You&apos;ve been invited to the anchoring team workspace.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4 space-y-1.5 rounded-lg border border-border bg-secondary/40 p-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Email</span>
            <span className="font-medium">{email}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Role</span>
            <Badge>
              {ROLE_LABELS[roleLabel as Role] ?? roleLabel}
            </Badge>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Full name</Label>
            <Input
              id="fullName"
              name="fullName"
              defaultValue={fullName}
              required
              minLength={2}
              disabled={pending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              disabled={pending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm password</Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
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
            {pending ? "Creating account…" : "Create account & join"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

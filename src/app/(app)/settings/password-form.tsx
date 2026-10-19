"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updatePasswordAction } from "@/actions/auth";

export function PasswordForm() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirmPassword = String(form.get("confirmPassword") ?? "");

    startTransition(async () => {
      const result = await updatePasswordAction({ password, confirmPassword });
      if (!result.ok) {
        setError(result.error ?? "Failed to update password.");
        return;
      }
      toast.success("Password updated");
      (e.target as HTMLFormElement).reset();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="pw-new">New password</Label>
        <Input id="pw-new" name="password" type="password" required minLength={8} disabled={pending} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="pw-confirm">Confirm password</Label>
        <Input id="pw-confirm" name="confirmPassword" type="password" required minLength={8} disabled={pending} />
      </div>

      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : null}

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : null}
          {pending ? "Updating…" : "Update password"}
        </Button>
      </div>
    </form>
  );
}

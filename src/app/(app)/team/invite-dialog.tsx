"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, UserPlus, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createInviteAction } from "@/actions/team";
import { ROLES, ROLE_LABELS } from "@/types/database";

export function InviteDialog() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<string>("team_member");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);

  function handleInvite() {
    if (!email.trim() || !fullName.trim()) {
      setError("Email and full name are required.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await createInviteAction({
        email: email.trim(),
        fullName: fullName.trim(),
        role: role as any,
      });
      if (!result.ok) {
        setError(result.error ?? "Failed to create invite.");
        return;
      }
      const url = `${window.location.origin}/invite/${result.token}`;
      setInviteUrl(url);
    });
  }

  function copyUrl() {
    if (!inviteUrl) return;
    navigator.clipboard.writeText(inviteUrl);
    toast.success("Invite link copied");
  }

  function reset() {
    setOpen(false);
    setEmail("");
    setFullName("");
    setRole("team_member");
    setInviteUrl(null);
    setError(null);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); setOpen(v); }}>
      <DialogTrigger asChild>
        <Button size="sm">
          <UserPlus className="h-4 w-4" /> Invite member
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite a team member</DialogTitle>
          <DialogDescription>
            Create an invite link and share it with the person you want to add.
            They will set their own password when they open the link.
          </DialogDescription>
        </DialogHeader>

        {inviteUrl ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Share this link with <strong>{fullName}</strong>. It expires in 7 days.
            </p>
            <div className="flex items-center gap-2">
              <Input readOnly value={inviteUrl} className="flex-1 text-xs" />
              <Button variant="outline" size="sm" onClick={copyUrl}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <Button variant="outline" className="w-full" onClick={reset}>
              Done
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="inv-email">Email</Label>
              <Input
                id="inv-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="member@college.edu"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inv-name">Full name</Label>
              <Input
                id="inv-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {error ? (
              <p className="text-sm text-destructive">{error}</p>
            ) : null}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
                Cancel
              </Button>
              <Button onClick={handleInvite} disabled={pending}>
                {pending ? <Loader2 className="animate-spin" /> : null}
                {pending ? "Creating…" : "Create invite"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

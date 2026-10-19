"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Mail, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { revokeInviteAction } from "@/actions/team";
import { ROLE_LABELS, type Role } from "@/types/database";
import { relativeTime } from "@/lib/utils";

interface Invite {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  status: string;
  expires_at: string;
  created_at: string;
}

export function PendingInvites({ invites }: { invites: Invite[] }) {
  const [pending, startTransition] = useTransition();

  function handleRevoke(inviteId: string) {
    if (!confirm("Revoke this invite?")) return;
    startTransition(async () => {
      const result = await revokeInviteAction({ inviteId });
      if (!result.ok) {
        toast.error(result.error ?? "Failed to revoke invite.");
        return;
      }
      toast.success("Invite revoked");
      window.location.reload();
    });
  }

  if (invites.length === 0) {
    return <p className="py-2 text-sm text-muted-foreground">No pending invites.</p>;
  }

  return (
    <div className="space-y-2">
      {invites.map((invite) => (
        <div
          key={invite.id}
          className="flex flex-col gap-3 rounded-none border-2 border-foreground px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex min-w-0 items-center gap-3">
            <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{invite.full_name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {invite.email} · invited {relativeTime(invite.created_at)} ·
                expires {relativeTime(invite.expires_at)}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
            <Badge variant="outline">{ROLE_LABELS[invite.role]}</Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleRevoke(invite.id)}
              disabled={pending}
              className="text-muted-foreground hover:text-destructive"
            >
              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

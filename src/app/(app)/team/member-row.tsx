"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { initials } from "@/lib/utils";
import { ROLE_LABELS, type Role } from "@/types/database";
import { updateMemberRoleAction } from "@/actions/team";

interface Member {
  id: string;
  full_name: string;
  email: string;
  role: Role;
  status: string;
  avatar_url: string | null;
  created_at: string;
}

export function MemberRow({
  member,
  isOfficer,
  currentUserId,
  currentUserRole,
}: {
  member: Member;
  isOfficer: boolean;
  currentUserId: string;
  currentUserRole: Role;
}) {
  const [pending, startTransition] = useTransition();
  const isSelf = member.id === currentUserId;

  function changeRole(role: Role) {
    startTransition(async () => {
      const result = await updateMemberRoleAction({
        profileId: member.id,
        role,
        status: "active",
      });
      if (!result.ok) {
        toast.error(result.error ?? "Failed to update role.");
        return;
      }
      toast.success("Role updated");
      window.location.reload();
    });
  }

  function toggleSuspend() {
    const next = member.status === "active" ? "suspended" : "active";
    startTransition(async () => {
      const result = await updateMemberRoleAction({
        profileId: member.id,
        role: member.role,
        status: next,
      });
      if (!result.ok) {
        toast.error(result.error ?? "Failed to update member.");
        return;
      }
      toast.success(next === "suspended" ? "Member suspended" : "Member reactivated");
      window.location.reload();
    });
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <Avatar className="h-9 w-9">
          <AvatarImage src={member.avatar_url ?? undefined} alt="" />
          <AvatarFallback className="text-xs">{initials(member.full_name)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">
            {member.full_name}
            {isSelf ? <span className="ml-1 text-xs text-muted-foreground">(you)</span> : null}
          </p>
          <p className="truncate text-xs text-muted-foreground">{member.email}</p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Badge>{ROLE_LABELS[member.role]}</Badge>
        {member.status === "suspended" ? (
          <Badge variant="destructive">Suspended</Badge>
        ) : null}

        {isOfficer && !isSelf ? (
          <div className="flex items-center gap-1">
            <select
              value={member.role}
              onChange={(e) => changeRole(e.target.value as Role)}
              disabled={pending}
              className="rounded-md border border-input bg-background px-2 py-1 text-xs"
            >
              {Object.entries(ROLE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleSuspend}
              disabled={pending}
              className="text-xs text-muted-foreground"
            >
              {member.status === "active" ? "Suspend" : "Reactivate"}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

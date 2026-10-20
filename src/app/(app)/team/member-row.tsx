"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { initials } from "@/lib/utils";
import { ROLE_LABELS, type Role } from "@/types/database";
import { updateMemberRoleAction, deleteMemberAction } from "@/actions/team";

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
  const router = useRouter();

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
      router.refresh();
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
      router.refresh();
    });
  }

  function removeMember() {
    if (
      !confirm(
        `Delete ${member.full_name} permanently? Their account and anything they created will be removed.`
      )
    ) {
      return;
    }
    startTransition(async () => {
      const result = await deleteMemberAction({ profileId: member.id });
      if (!result.ok) {
        toast.error(result.error ?? "Failed to delete member.");
        return;
      }
      toast.success("Member deleted");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-none border-2 border-foreground px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
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

      <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:justify-end">
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
              className="rounded-none border-2 border-input bg-background px-2 py-1 text-xs"
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
            <Button
              variant="ghost"
              size="sm"
              onClick={removeMember}
              disabled={pending}
              aria-label={`Delete ${member.full_name}`}
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

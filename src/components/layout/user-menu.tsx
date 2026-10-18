"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, UserRound } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { initials } from "@/lib/utils";
import { ROLE_LABELS, type Profile } from "@/types/database";
import { logoutAction } from "@/actions/auth";

export function UserMenu({ profile }: { profile: Profile }) {
  const router = useRouter();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-9 gap-2 px-2">
          <Avatar className="h-6 w-6">
            <AvatarImage src={profile.avatar_url ?? undefined} alt="" />
            <AvatarFallback className="text-[10px]">
              {initials(profile.full_name)}
            </AvatarFallback>
          </Avatar>
          <span className="hidden max-w-[140px] truncate text-sm font-medium md:inline">
            {profile.full_name}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <p className="truncate text-sm font-medium text-foreground">{profile.full_name}</p>
          <p className="truncate text-xs font-normal text-muted-foreground">{profile.email}</p>
          <Badge className="mt-1.5">{ROLE_LABELS[profile.role]}</Badge>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <UserRound /> Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={async () => {
            await logoutAction();
            router.push("/login");
            router.refresh();
          }}
        >
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

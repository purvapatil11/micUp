import { Users, UserPlus, Mail } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isOfficer } from "@/lib/permissions";
import { formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { initials } from "@/lib/utils";
import { InviteDialog } from "./invite-dialog";
import { MemberRow } from "./member-row";
import { PendingInvites } from "./pending-invites";
import { ROLES, ROLE_LABELS, type Role } from "@/types/database";

export const metadata = { title: "Team" };
export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const user = await requireUser();
  const officer = isOfficer(user.profile.role);
  const supabase = await createClient();

  const [membersRes, invitesRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, email, role, status, avatar_url, created_at")
      .neq("status", "suspended")
      .order("full_name"),
    officer
      ? supabase
          .from("team_invites")
          .select("id, email, full_name, role, status, expires_at, created_at")
          .eq("status", "pending")
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);

  const members = membersRes.data ?? [];
  const pendingInvites = (invitesRes.data ?? []) as any[];

  const officers = members.filter((m) =>
    ["anchoring_officer", "deputy_anchoring_officer"].includes(m.role)
  );
  const teamMembers = members.filter((m) => m.role === "team_member");

  return (
    <div>
      <PageHeader
        title="Team"
        description="Anchoring team members and access management."
        actions={
          officer ? (
            <InviteDialog />
          ) : undefined
        }
      />

      {/* Officers */}
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Officers
        </h2>
        <div className="space-y-2">
          {officers.length === 0 ? (
            <p className="py-2 text-sm text-muted-foreground">No officers yet.</p>
          ) : (
            officers.map((m) => (
              <MemberRow key={m.id} member={m} isOfficer={officer} currentUserId={user.id} currentUserRole={user.profile.role} />
            ))
          )}
        </div>
      </section>

      {/* Team members */}
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Team members
        </h2>
        <div className="space-y-2">
          {teamMembers.length === 0 ? (
            <EmptyState
              icon={<Users className="h-5 w-5" />}
              title="No team members yet"
              description={officer ? "Invite members to get started." : "No team members have joined yet."}
            />
          ) : (
            teamMembers.map((m) => (
              <MemberRow key={m.id} member={m} isOfficer={officer} currentUserId={user.id} currentUserRole={user.profile.role} />
            ))
          )}
        </div>
      </section>

      {/* Pending invites (officers only) */}
      {officer ? (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Pending invites
          </h2>
          <PendingInvites invites={pendingInvites} />
        </section>
      ) : null}
    </div>
  );
}

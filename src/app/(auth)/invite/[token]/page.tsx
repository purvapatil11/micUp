import { redirect } from "next/navigation";
import { createAdminClient, hasServiceRoleClient } from "@/lib/supabase/admin";
import { createHash } from "crypto";
import { AcceptInviteForm } from "./accept-form";

export const metadata = { title: "Accept invitation" };

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  if (!hasServiceRoleClient()) {
    return (
      <CardShell
        title="Invites not configured"
        description="The server is missing SUPABASE_SERVICE_ROLE_KEY, so invitations cannot be completed. Ask your administrator to configure it and try again."
      />
    );
  }

  const admin = createAdminClient();
  const tokenHash = createHash("sha256").update(token).digest("hex");

  const { data: invite } = await admin
    .from("team_invites")
    .select("email, full_name, role, status, expires_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (!invite || invite.status !== "pending") {
    return (
      <CardShell
        title="Invite not available"
        description="This invite link is invalid, already used, or revoked. Ask an officer for a new invitation."
      />
    );
  }

  if (new Date(invite.expires_at) < new Date()) {
    return (
      <CardShell
        title="Invite expired"
        description="This invitation has expired. Ask an officer to send a fresh invite."
      />
    );
  }

  return (
    <AcceptInviteForm
      token={token}
      email={invite.email}
      fullName={invite.full_name}
      roleLabel={invite.role}
    />
  );
}

function CardShell({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-none border-2 border-foreground bg-card p-6 text-center shadow-[6px_6px_0_hsl(var(--primary))]">
      <h1 className="font-display text-lg font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

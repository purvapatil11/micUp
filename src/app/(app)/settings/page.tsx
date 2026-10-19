import { Settings, UserRound } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ProfileForm } from "./profile-form";
import { PasswordForm } from "./password-form";
import { Badge } from "@/components/ui/badge";
import { ROLE_LABELS } from "@/types/database";

export const metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireUser();

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Settings" description="Manage your profile and password." />

      <div className="space-y-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <UserRound className="h-4 w-4 text-muted-foreground" />
              Profile
            </CardTitle>
            <CardDescription>
              Your role is{" "}
              <Badge className="ml-0.5">{ROLE_LABELS[user.profile.role]}</Badge>. Role changes
              can only be made by an officer.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ProfileForm
              fullName={user.profile.full_name}
              email={user.profile.email}
              avatarUrl={user.profile.avatar_url}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Settings className="h-4 w-4 text-muted-foreground" />
              Password
            </CardTitle>
            <CardDescription>Update your account password.</CardDescription>
          </CardHeader>
          <CardContent>
            <PasswordForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

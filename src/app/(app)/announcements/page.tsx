import { Megaphone, Plus, CheckCircle2 } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isOfficer } from "@/lib/permissions";
import { relativeTime } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { PriorityBadge } from "@/components/domain-badges";
import { PublishAnnouncementDialog } from "./publish-dialog";
import { AcknowledgeButton } from "./acknowledge-button";
import { DeleteAnnouncementButton } from "./delete-button";

export const metadata = { title: "Announcements" };
export const dynamic = "force-dynamic";

export default async function AnnouncementsPage() {
  const user = await requireUser();
  const officer = isOfficer(user.profile.role);
  const supabase = await createClient();

  const [announcementsRes, acksRes] = await Promise.all([
    supabase
      .from("announcements")
      .select("id, title, message, priority, created_at, author:author_id(full_name)")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("announcement_acknowledgements")
      .select("announcement_id")
      .eq("profile_id", user.id),
  ]);

  const announcements = announcementsRes.data ?? [];
  const acknowledgedIds = new Set((acksRes.data ?? []).map((a) => a.announcement_id));

  return (
    <div>
      <PageHeader
        title="Announcements"
        description="Team-wide updates from the Anchoring Officer team."
        actions={
          officer ? (
            <PublishAnnouncementDialog />
          ) : undefined
        }
      />

      {announcements.length === 0 ? (
        <EmptyState
          icon={<Megaphone className="h-5 w-5" />}
          title="No announcements yet"
          description="Officers can publish announcements to keep the team informed."
        />
      ) : (
        <div className="space-y-3">
          {announcements.map((a) => {
            const acknowledged = acknowledgedIds.has(a.id);
            return (
              <Card key={a.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold">{a.title}</h3>
                        <PriorityBadge priority={a.priority} />
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                        {a.message}
                      </p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {(a as any).author?.full_name ?? "Unknown"} · {relativeTime(a.created_at)}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      {acknowledged ? (
                        <span className="inline-flex items-center gap-1 text-xs text-success">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Acknowledged
                        </span>
                      ) : (
                        <AcknowledgeButton announcementId={a.id} />
                      )}
                      {officer ? (
                        <DeleteAnnouncementButton announcementId={a.id} />
                      ) : null}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

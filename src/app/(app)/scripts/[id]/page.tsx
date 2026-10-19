import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, User, Clock } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isOfficer } from "@/lib/permissions";
import { formatDate, relativeTime, formatDateTime } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ScriptStatusBadge,
  ScriptCategoryBadge,
} from "@/components/domain-badges";
import { ScriptEditor } from "@/components/script/script-editor";
import { ScriptDiscussion } from "@/components/script/script-discussion";
import { VersionHistory } from "@/components/script/version-history";

export const metadata = { title: "Script" };
export const dynamic = "force-dynamic";

export default async function ScriptDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const officer = isOfficer(user.profile.role);
  const supabase = await createClient();

  const { data: script } = await supabase
    .from("scripts")
    .select(
      "id, title, content, status, category, revision, deadline, event_id, assigned_to, created_at, updated_at, created_by, updated_by, events(id, name, event_date), creator:created_by(full_name), last_editor:updated_by(full_name)"
    )
    .eq("id", id)
    .maybeSingle();

  if (!script) notFound();

  const { data: versions } = await supabase
    .from("script_versions")
    .select("id, revision, title, content, status, note, created_at, author:created_by(full_name)")
    .eq("script_id", id)
    .order("revision", { ascending: false })
    .limit(50);

  const { data: comments } = await supabase
    .from("script_comments")
    .select("id, body, created_at, author_id, author:author_id(full_name)")
    .eq("script_id", id)
    .order("created_at", { ascending: true });

  const { data: assignedMembers } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", script.assigned_to ?? []);

  return (
    <div>
      <div className="mb-4">
        <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
          <Link href="/scripts">
            <ArrowLeft className="h-4 w-4" /> Back to scripts
          </Link>
        </Button>
      </div>

      <PageHeader
        title={script.title}
        actions={
          <div className="flex items-center gap-2">
            <ScriptStatusBadge status={script.status} />
            <ScriptCategoryBadge category={script.category} />
            <VersionHistory
              scriptId={script.id}
              versions={(versions ?? []) as any}
              isOfficer={officer}
            />
          </div>
        }
      />

      {/* Meta bar */}
      <div className="mb-6 flex flex-wrap gap-x-6 gap-y-2 rounded-lg border border-border bg-card/60 px-4 py-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <CalendarDays className="h-3.5 w-3.5" />
          {script.events ? (
            <Link href={`/events/${script.events.id}`} className="hover:text-foreground">
              {script.events.name} · {formatDate(script.events.event_date)}
            </Link>
          ) : (
            "No event linked"
          )}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <User className="h-3.5 w-3.5" />
          Created by {script.creator?.full_name ?? "Unknown"} · {relativeTime(script.created_at)}
        </span>
        {script.last_editor ? (
          <span className="inline-flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            Last edit by {script.last_editor.full_name} · {relativeTime(script.updated_at)}
          </span>
        ) : null}
        {script.deadline ? (
          <span>Deadline: {formatDate(script.deadline)}</span>
        ) : null}
        {assignedMembers && assignedMembers.length > 0 ? (
          <span>
            Anchors: {assignedMembers.map((m) => m.full_name).join(", ")}
          </span>
        ) : null}
        <span>rev {script.revision}</span>
      </div>

      {/* Editor */}
      <Card>
        <CardContent className="pt-6">
          <ScriptEditor
            scriptId={script.id}
            title={script.title}
            content={script.content}
            status={script.status}
            revision={script.revision}
            updatedAt={script.updated_at}
            updatedByName={script.last_editor?.full_name ?? null}
            role={user.profile.role}
          />
        </CardContent>
      </Card>

      {/* Discussion */}
      <div className="mt-8">
        <ScriptDiscussion
          scriptId={script.id}
          comments={(comments ?? []) as any}
          profile={user.profile}
        />
      </div>
    </div>
  );
}

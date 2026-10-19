import Link from "next/link";
import { FileDown, FileText, Plus } from "lucide-react";
import { requireUser, getActiveMembers } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isOfficer } from "@/lib/permissions";
import { formatDate, relativeTime } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScriptStatusBadge, ScriptCategoryBadge } from "@/components/domain-badges";
import { ScriptsFilterBar } from "./scripts-filter-bar";
import {
  SCRIPT_STATUSES,
  SCRIPT_CATEGORIES,
} from "@/types/database";

export const metadata = { title: "Scripts" };
export const dynamic = "force-dynamic";

export default async function ScriptsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; category?: string; q?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const officer = isOfficer(user.profile.role);
  const supabase = await createClient();

  let query = supabase
    .from("scripts")
    .select(
      "id, title, status, category, deadline, updated_at, created_at, event_id, events(id, name, event_date), creator:created_by(full_name), last_editor:updated_by(full_name)"
    );

  if (params.status && SCRIPT_STATUSES.includes(params.status as any)) {
    query = query.eq("status", params.status);
  }
  if (params.category && SCRIPT_CATEGORIES.includes(params.category as any)) {
    query = query.eq("category", params.category);
  }
  if (params.q && params.q.trim().length > 0) {
    query = query.ilike("title", `%${params.q.trim()}%`);
  }

  const { data: scripts, error } = await query
    .order("updated_at", { ascending: false })
    .limit(100);

  if (error) {
    return (
      <div>
        <PageHeader title="Scripts" description="Collaborative anchoring scripts." />
        <p className="text-sm text-destructive">Failed to load scripts: {error.message}</p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Scripts"
        description="Write, review and approve anchoring scripts with your team."
        actions={
          <Button asChild size="sm">
            <Link href="/scripts/new">
              <Plus /> New script
            </Link>
          </Button>
        }
      />

      {/* Filters */}
      <ScriptsFilterBar
        q={params.q ?? ""}
        status={
          params.status && SCRIPT_STATUSES.includes(params.status as any)
            ? params.status
            : "all"
        }
        category={
          params.category && SCRIPT_CATEGORIES.includes(params.category as any)
            ? params.category
            : "all"
        }
      />

      {scripts.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-5 w-5" />}
          title="No scripts yet"
          description="Create your first anchoring script to get started."
          action={
            <Button asChild size="sm">
              <Link href="/scripts/new">
                <Plus /> New script
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {scripts.map((script) => (
            <div key={script.id} className="flex h-full flex-col">
              <Link href={`/scripts/${script.id}`} className="block flex-1">
                <Card className="h-full transition-colors hover:border-primary/40">
                  <CardContent className="space-y-3 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="line-clamp-2 text-sm font-semibold leading-snug">
                        {script.title}
                      </h3>
                      <ScriptStatusBadge status={script.status} />
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <ScriptCategoryBadge category={script.category} />
                      {(script as any).events ? (
                        <Badge variant="outline" className="font-normal">
                          {(script as any).events.name}
                        </Badge>
                      ) : null}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {script.deadline ? (
                        <p>Deadline: {formatDate(script.deadline)}</p>
                      ) : null}
                      <p>Updated {relativeTime(script.updated_at)}</p>
                      {(script as any).last_editor ? (
                        <p>by {(script as any).last_editor.full_name}</p>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              </Link>
              <div className="mt-1.5 flex justify-end">
                <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
                  <Link
                    href={`/scripts/${script.id}/export`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <FileDown className="h-3.5 w-3.5" /> Export PDF
                  </Link>
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

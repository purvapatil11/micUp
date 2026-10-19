import Link from "next/link";
import { FileText, Plus, Search } from "lucide-react";
import { requireUser, getActiveMembers } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isOfficer } from "@/lib/permissions";
import { formatDate, relativeTime } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScriptStatusBadge, ScriptCategoryBadge } from "@/components/domain-badges";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  SCRIPT_STATUSES,
  SCRIPT_STATUS_LABELS,
  SCRIPT_CATEGORIES,
  SCRIPT_CATEGORY_LABELS,
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
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <form className="flex-1" method="GET">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              name="q"
              defaultValue={params.q ?? ""}
              placeholder="Search by title…"
              className="pl-9"
            />
          </div>
          <input type="hidden" name="status" value={params.status ?? ""} />
          <input type="hidden" name="category" value={params.category ?? ""} />
        </form>
        <div className="flex gap-2">
          <Select
            defaultValue={params.status ?? "all"}
            onValueChange={(v) => {
              const url = new URL(window.location.href);
              if (v === "all") url.searchParams.delete("status");
              else url.searchParams.set("status", v);
              window.location.href = url.toString();
            }}
          >
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {SCRIPT_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {SCRIPT_STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            defaultValue={params.category ?? "all"}
            onValueChange={(v) => {
              const url = new URL(window.location.href);
              if (v === "all") url.searchParams.delete("category");
              else url.searchParams.set("category", v);
              window.location.href = url.toString();
            }}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {SCRIPT_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {SCRIPT_CATEGORY_LABELS[c]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

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
            <Link key={script.id} href={`/scripts/${script.id}`}>
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
          ))}
        </div>
      )}
    </div>
  );
}

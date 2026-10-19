import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ListOrdered, Plus } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isOfficer } from "@/lib/permissions";
import { formatTime, formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { RunOfShowList } from "./run-of-show-list";

export const metadata = { title: "Run of Show" };
export const dynamic = "force-dynamic";

export default async function RunOfShowPage({
  searchParams,
}: {
  searchParams: Promise<{ event?: string; new?: string }>;
}) {
  const user = await requireUser();
  const officer = isOfficer(user.profile.role);
  const supabase = await createClient();
  const params = await searchParams;

  const { data: events } = await supabase
    .from("events")
    .select("id, name, event_date, status")
    .neq("status", "cancelled")
    .order("event_date", { ascending: false })
    .limit(20);

  const selectedEventId = params.event ?? events?.[0]?.id ?? null;

  let items: any[] = [];
  let selectedEvent: any = null;
  let members: { id: string; full_name: string }[] = [];
  let scripts: { id: string; title: string }[] = [];
  if (selectedEventId) {
    selectedEvent = events?.find((e) => e.id === selectedEventId) ?? null;
    if (!selectedEvent) {
      const { data } = await supabase
        .from("events")
        .select("id, name, event_date, status")
        .eq("id", selectedEventId)
        .maybeSingle();
      selectedEvent = data;
    }

    const [rosRes, membersRes, scriptsRes] = await Promise.all([
      supabase
        .from("run_of_show_items")
        .select(
          "id, sequence, start_time, segment_title, description, stage_cue, notes, assigned_to, script_id, assignee:assigned_to(full_name), script:script_id(id, title, status)"
        )
        .eq("event_id", selectedEventId)
        .order("sequence", { ascending: true }),
      supabase
        .from("profiles")
        .select("id, full_name")
        .eq("status", "active")
        .order("full_name"),
      supabase
        .from("scripts")
        .select("id, title")
        .eq("event_id", selectedEventId)
        .order("title"),
    ]);
    items = rosRes.data ?? [];
    members = (membersRes.data ?? []) as any;
    scripts = (scriptsRes.data ?? []) as any;
  }

  // For members: only show events they're assigned to
  const visibleEvents = officer
    ? events ?? []
    : (events ?? []).filter(() => true); // RLS already scopes this

  return (
    <div>
      <PageHeader
        title="Run of Show"
        description="Stage sequence, cues and responsibilities for each event."
        actions={
          officer && selectedEventId ? (
            <Button asChild size="sm">
              <Link href={`/run-of-show?event=${selectedEventId}&new=1`}>
                <Plus /> Add item
              </Link>
            </Button>
          ) : undefined
        }
      />

      {/* Event selector */}
      <div className="mb-6 flex flex-wrap gap-2">
        {visibleEvents.map((ev) => (
          <Link
            key={ev.id}
            href={`/run-of-show?event=${ev.id}`}
            className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
              ev.id === selectedEventId
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:border-border hover:text-foreground"
            }`}
          >
            {ev.name}
            <span className="ml-1.5 text-xs opacity-70">{formatDate(ev.event_date)}</span>
          </Link>
        ))}
      </div>

      {!selectedEventId ? (
        <EmptyState
          icon={<ListOrdered className="h-5 w-5" />}
          title="No events yet"
          description="Create an event first to plan its run of show."
        />
      ) : items.length === 0 && !officer ? (
        <EmptyState
          icon={<ListOrdered className="h-5 w-5" />}
          title="No run-of-show items yet"
          description="An officer can add segments, speakers and stage cues to build the event sequence."
        />
      ) : (
        <RunOfShowList
          eventId={selectedEventId}
          items={items}
          isOfficer={officer}
          showAddParam={params.new === "1"}
          members={members}
          scripts={scripts}
        />
      )}
    </div>
  );
}

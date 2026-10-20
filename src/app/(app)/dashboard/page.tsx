import Link from "next/link";
import { CalendarDays, Plus } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isOfficer } from "@/lib/permissions";
import { formatDate, relativeTime, formatTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScriptStatusBadge, EventStatusBadge, PriorityBadge } from "@/components/domain-badges";
import type {
  Script,
  EventRow,
  Announcement,
  AttendanceRecord,
} from "@/types/database";

export const metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const officer = isOfficer(user.profile.role);
  const today = new Date().toISOString().slice(0, 10);

  const [
    upcomingEventsRes,
    myScriptsRes,
    announcementsRes,
    acksRes,
    myAttendanceRes,
  ] = await Promise.all([
    supabase
      .from("events")
      .select("id, name, event_date, start_time, venue, status")
      .gte("event_date", today)
      .neq("status", "cancelled")
      .order("event_date")
      .limit(5),
    supabase
      .from("scripts")
      .select("id, title, status, category, deadline, updated_at, event_id, events(id, name, event_date)")
      .contains("assigned_to", [user.id])
      .order("updated_at", { ascending: false })
      .limit(6),
    supabase
      .from("announcements")
      .select("id, title, message, priority, created_at, author:profiles(full_name)")
      .order("created_at", { ascending: false })
      .limit(4),
    supabase
      .from("announcement_acknowledgements")
      .select("announcement_id")
      .eq("profile_id", user.id),
    supabase
      .from("attendance")
      .select("id, status, method, checked_in_at, event_id, events(id, name, event_date)")
      .eq("profile_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const upcomingEvents = (upcomingEventsRes.data ?? []) as unknown as Pick<
    EventRow,
    "id" | "name" | "event_date" | "start_time" | "venue" | "status"
  >[];
  const myScripts = (myScriptsRes.data ?? []) as unknown as Pick<
    Script,
    "id" | "title" | "status" | "category" | "deadline" | "updated_at"
  >[] & { events: { id: string; name: string } | null }[];
  const announcements = (announcementsRes.data ?? []) as unknown as (Pick<
    Announcement,
    "id" | "title" | "message" | "priority" | "created_at"
  > & { author: { full_name: string } | null })[];
  const acknowledgedIds = new Set((acksRes.data ?? []).map((a) => a.announcement_id));
  const myAttendance = (myAttendanceRes.data ?? []) as unknown as (Pick<
    AttendanceRecord,
    "id" | "status" | "method" | "checked_in_at" | "event_id"
  > & { events: { id: string; name: string; event_date: string } | null })[];

  return (
    <div>
      {/* Welcome */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Welcome, {user.profile.full_name.split(" ")[0]}
          </h1>
          <p className="text-sm text-muted-foreground">
            Everything the anchoring team is working on, right now.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/scripts/new">
              <Plus /> New Script
            </Link>
          </Button>
          {officer ? (
            <Button asChild size="sm">
              <Link href="/events/new">
                <CalendarDays /> Create Event
              </Link>
            </Button>
          ) : null}
        </div>
      </div>

      {/* Upcoming events */}
      <Card className="mb-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Upcoming events</CardTitle>
        </CardHeader>
        <CardContent className="max-h-64 space-y-2 overflow-y-auto">
          {upcomingEvents.length === 0 ? (
            <p className="py-3 text-sm text-muted-foreground">No upcoming events yet.</p>
          ) : (
            upcomingEvents.map((event) => (
              <Link
                key={event.id}
                href={`/events/${event.id}`}
                className="flex items-center justify-between rounded-none border-2 border-foreground px-3 py-2 transition-colors hover:bg-secondary"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{event.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {formatDate(event.event_date)}
                    {event.start_time ? ` · ${formatTime(event.start_time)}` : ""}
                    {event.venue ? ` · ${event.venue}` : ""}
                  </p>
                </div>
                <EventStatusBadge status={event.status} />
              </Link>
            ))
          )}
        </CardContent>
      </Card>

      {/* Assigned scripts + Stage notices */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">My assigned scripts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {myScripts.length === 0 ? (
              <p className="py-3 text-sm text-muted-foreground">
                Nothing assigned to you yet.
              </p>
            ) : (
              myScripts.map((script) => (
                <Link
                  key={script.id}
                  href={`/scripts/${script.id}`}
                  className="flex items-center justify-between gap-2 rounded-none border-2 border-foreground px-3 py-2 transition-colors hover:bg-secondary"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{script.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {(script as { events?: { name: string } | null }).events?.name ?? "No event"}{" "}
                      · edited {relativeTime(script.updated_at)}
                    </p>
                  </div>
                  <ScriptStatusBadge status={script.status} />
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Stage notices</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {announcements.length === 0 ? (
              <p className="py-3 text-sm text-muted-foreground">Nothing announced yet.</p>
            ) : (
              announcements.map((a) => (
                <Link
                  key={a.id}
                  href="/announcements"
                  className="block rounded-none border-2 border-foreground px-3 py-2 transition-colors hover:bg-secondary"
                >
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium">{a.title}</p>
                    <PriorityBadge priority={a.priority} />
                    {!acknowledgedIds.has(a.id) && a.priority !== "normal" ? (
                      <span className="ml-auto shrink-0 text-[10px] font-semibold uppercase text-primary">
                        Needs ack
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {a.author?.full_name ?? "Unknown"} · {relativeTime(a.created_at)}
                  </p>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Attendance */}
      <Card className="mt-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Your attendance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {myAttendance.length === 0 ? (
            <p className="py-3 text-sm text-muted-foreground">
              No attendance records yet.
            </p>
          ) : (
            myAttendance.map((record) => (
              <Link
                key={record.id}
                href={`/events/${record.event_id}/attendance`}
                className="flex items-center justify-between gap-2 rounded-none border-2 border-foreground px-3 py-2 transition-colors hover:bg-secondary"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {record.events?.name ?? "Event"}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {record.checked_in_at
                      ? `Checked in ${relativeTime(record.checked_in_at)}`
                      : "No check-in"}
                  </p>
                </div>
                <span
                  className={
                    record.status === "present"
                      ? "text-xs font-semibold text-success"
                      : "text-xs font-semibold text-muted-foreground"
                  }
                >
                  {record.status}
                </span>
              </Link>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

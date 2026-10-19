import Link from "next/link";
import {
  CalendarDays,
  FileText,
  Megaphone,
  MessageSquare,
  ClipboardCheck,
  Plus,
  Radio,
  CheckCircle2,
  UserRoundCheck,
} from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isOfficer, allowedStatusTransitions } from "@/lib/permissions";
import { formatDate, relativeTime, formatTime } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScriptStatusBadge, EventStatusBadge, PriorityBadge } from "@/components/domain-badges";
import type {
  Script,
  EventRow,
  Announcement,
  ScriptComment,
  AttendanceRecord,
  EventAssignment,
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
    reviewScriptsRes,
    readyScriptsRes,
    commentsRes,
    announcementsRes,
    acksRes,
    myAssignmentsRes,
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
      .from("scripts")
      .select("id, title, status, category, updated_at, updated_by, profiles:updated_by(full_name), events(id, name)")
      .eq("status", "need_review")
      .order("updated_at", { ascending: false })
      .limit(6),
    supabase
      .from("scripts")
      .select("id, title, status, category, updated_at, events(id, name)")
      .eq("status", "ready")
      .order("updated_at", { ascending: false })
      .limit(4),
    supabase
      .from("script_comments")
      .select("id, body, created_at, script_id, author:profiles(full_name), scripts(id, title)")
      .order("created_at", { ascending: false })
      .limit(5),
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
      .from("event_assignments")
      .select("id, responsibility, events(id, name, event_date, start_time, venue, status)")
      .eq("profile_id", user.id)
      .order("created_at", { ascending: false }),
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
  const reviewScripts = reviewScriptsRes.data ?? [];
  const readyScripts = readyScriptsRes.data ?? [];
  const recentComments = (commentsRes.data ?? []) as unknown as (Pick<
    ScriptComment,
    "id" | "body" | "created_at" | "script_id"
  > & {
    author: { full_name: string } | null;
    scripts: { id: string; title: string } | null;
  })[];
  const announcements = (announcementsRes.data ?? []) as unknown as (Pick<
    Announcement,
    "id" | "title" | "message" | "priority" | "created_at"
  > & { author: { full_name: string } | null })[];
  const acknowledgedIds = new Set((acksRes.data ?? []).map((a) => a.announcement_id));
  const myAssignments = (myAssignmentsRes.data ?? []) as unknown as (Pick<
    EventAssignment,
    "id" | "responsibility"
  > & { events: Pick<EventRow, "id" | "name" | "event_date" | "start_time" | "venue" | "status"> | null })[];
  const myAttendance = (myAttendanceRes.data ?? []) as unknown as (Pick<
    AttendanceRecord,
    "id" | "status" | "method" | "checked_in_at" | "event_id"
  > & { events: { id: string; name: string; event_date: string } | null })[];

  const upcomingAssignments = myAssignments
    .filter((a) => a.events && a.events.event_date >= today && a.events.status !== "cancelled")
    .slice(0, 5);

  return (
    <div>
      <PageHeader
        title={`Hello, ${user.profile.full_name.split(" ")[0]}`}
        description="Everything the anchoring team is working on, right now."
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link href="/announcements">
                <Megaphone /> Announcements
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/scripts/new">
                <Plus /> New script
              </Link>
            </Button>
          </>
        }
      />

      {officer ? (
        <div className="mb-6 flex flex-wrap gap-2">
          <Button asChild variant="secondary" size="sm">
            <Link href="/events/new">
              <CalendarDays /> Create event
            </Link>
          </Button>
          <Button asChild variant="secondary" size="sm">
            <Link href="/announcements">
              <Megaphone /> Publish announcement
            </Link>
          </Button>
          <Button asChild variant="secondary" size="sm">
            <Link href="/team">
              <UserRoundCheck /> Invite member
            </Link>
          </Button>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Upcoming events */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold">Upcoming events</CardTitle>
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-2">
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

        {/* My scripts */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold">Scripts assigned to you</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
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

        {/* Needs review */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold">
              {officer ? "Waiting for your review" : "Needs review"}
            </CardTitle>
            <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-2">
            {reviewScripts.length === 0 ? (
              <p className="py-3 text-sm text-muted-foreground">
                No scripts are waiting for review.
              </p>
            ) : (
              (reviewScripts as unknown as { id: string; title: string; profiles?: { full_name: string } | null; events?: { name: string } | null }[]).map(
                (script) => (
                  <Link
                    key={script.id}
                    href={`/scripts/${script.id}`}
                    className="block rounded-none border-2 border-foreground px-3 py-2 transition-colors hover:bg-secondary"
                  >
                    <p className="truncate text-sm font-medium">{script.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      by {script.profiles?.full_name ?? "Unknown"}
                      {script.events?.name ? ` · ${script.events.name}` : ""}
                    </p>
                  </Link>
                )
              )
            )}
          </CardContent>
        </Card>

        {/* Ready scripts */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold">Ready for the stage</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent className="space-y-2">
            {readyScripts.length === 0 ? (
              <p className="py-3 text-sm text-muted-foreground">No approved scripts yet.</p>
            ) : (
              (readyScripts as unknown as { id: string; title: string; events?: { name: string } | null }[]).map(
                (script) => (
                  <Link
                    key={script.id}
                    href={`/scripts/${script.id}`}
                    className="flex items-center justify-between gap-2 rounded-none border-2 border-foreground px-3 py-2 transition-colors hover:bg-secondary"
                  >
                    <p className="truncate text-sm font-medium">{script.title}</p>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {script.events?.name ?? ""}
                    </span>
                  </Link>
                )
              )
            )}
          </CardContent>
        </Card>

        {/* Recent discussions */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold">Recent script discussions</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-2.5">
            {recentComments.length === 0 ? (
              <p className="py-3 text-sm text-muted-foreground">
                No discussion yet — open a script to start one.
              </p>
            ) : (
              recentComments.map((comment) => (
                <Link
                  key={comment.id}
                  href={`/scripts/${comment.script_id}`}
                  className="block rounded-none border-2 border-foreground px-3 py-2 transition-colors hover:bg-secondary"
                >
                  <p className="line-clamp-1 text-sm">{comment.body}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {comment.author?.full_name ?? "Unknown"} on{" "}
                    {comment.scripts?.title ?? "a script"} · {relativeTime(comment.created_at)}
                  </p>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        {/* Announcements */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold">Announcements</CardTitle>
            <Megaphone className="h-4 w-4 text-muted-foreground" />
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

        {/* My responsibilities */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold">Your upcoming responsibilities</CardTitle>
            <Radio className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-2">
            {upcomingAssignments.length === 0 ? (
              <p className="py-3 text-sm text-muted-foreground">
                No assignments for upcoming events.
              </p>
            ) : (
              upcomingAssignments.map((assignment) => (
                <Link
                  key={assignment.id}
                  href={`/events/${assignment.events!.id}`}
                  className="block rounded-none border-2 border-foreground px-3 py-2 transition-colors hover:bg-secondary"
                >
                  <p className="truncate text-sm font-medium">{assignment.events!.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {assignment.responsibility ?? "Team member"}
                    {" · "}
                    {formatDate(assignment.events!.event_date)}
                  </p>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        {/* Attendance */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold">Your attendance</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
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

        {/* Quick actions */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Quick actions</CardTitle>
            <CardDescription>
              {officer
                ? "Officer tools are available on top of member actions."
                : "Jump straight into your usual tasks."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Button asChild variant="outline" size="sm" className="justify-start">
              <Link href="/scripts/new">
                <Plus /> Write a new script
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="justify-start">
              <Link href="/events">
                <CalendarDays /> Open events
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="justify-start">
              <Link href="/announcements">
                <Megaphone /> View announcements
              </Link>
            </Button>
            {officer ? (
              <>
                <Button asChild variant="outline" size="sm" className="justify-start">
                  <Link href="/scripts?status=need_review">
                    <ClipboardCheck /> Review queue
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm" className="justify-start">
                  <Link href="/team">
                    <UserRoundCheck /> Manage team
                  </Link>
                </Button>
              </>
            ) : (
              <p className="px-1 pt-1 text-xs text-muted-foreground">
                {allowedStatusTransitions(user.profile.role)
                  .map((s) => s.replace("_", " "))
                  .join(", ")}{" "}
                statuses available to you — final approval stays with officers.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

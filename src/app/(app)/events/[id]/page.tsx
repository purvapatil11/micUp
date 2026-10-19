import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  MapPin,
  Clock,
  Users,
  FileText,
  ListOrdered,
  Radio,
} from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isOfficer } from "@/lib/permissions";
import { formatDate, formatTime } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EventStatusBadge, ScriptStatusBadge } from "@/components/domain-badges";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata = { title: "Event" };
export const dynamic = "force-dynamic";

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const officer = isOfficer(user.profile.role);
  const supabase = await createClient();

  const { data: event } = await supabase
    .from("events")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!event) notFound();

  const [assignmentsRes, scriptsRes, rosRes, attendanceRes] = await Promise.all([
    supabase
      .from("event_assignments")
      .select("id, responsibility, profile_id, member:profiles(id, full_name, role)")
      .eq("event_id", id),
    supabase
      .from("scripts")
      .select("id, title, status, category")
      .eq("event_id", id)
      .order("updated_at", { ascending: false }),
    supabase
      .from("run_of_show_items")
      .select("id, sequence, start_time, segment_title, stage_cue, assignee:assigned_to(full_name)")
      .eq("event_id", id)
      .order("sequence", { ascending: true }),
    supabase
      .from("attendance")
      .select("id, status, method, checked_in_at, member:profiles!attendance_profile_id_fkey(full_name)")
      .eq("event_id", id),
  ]);

  const assignments = assignmentsRes.data ?? [];
  const scripts = scriptsRes.data ?? [];
  const rosItems = rosRes.data ?? [];
  const attendance = attendanceRes.data ?? [];

  return (
    <div>
      <div className="mb-4">
        <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
          <Link href="/events">
            <ArrowLeft className="h-4 w-4" /> Back to events
          </Link>
        </Button>
      </div>

      <PageHeader
        title={event.name}
        actions={
          <div className="flex items-center gap-2">
            <EventStatusBadge status={event.status} />
            {officer ? (
              <Button asChild size="sm" variant="outline">
                <Link href={`/events/${id}/attendance`}>
                  <Radio className="h-4 w-4" /> Attendance
                </Link>
              </Button>
            ) : (
              <Button asChild size="sm" variant="outline">
                <Link href={`/events/${id}/attendance`}>
                  <Radio className="h-4 w-4" /> Check in
                </Link>
              </Button>
            )}
            {officer ? (
              <Button asChild size="sm">
                <Link href={`/run-of-show?event=${id}`}>
                  <ListOrdered className="h-4 w-4" /> Run of show
                </Link>
              </Button>
            ) : null}
          </div>
        }
      />

      {/* Meta */}
      <div className="mb-6 flex flex-wrap gap-x-6 gap-y-2 rounded-none border-2 border-foreground bg-background px-4 py-3 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <CalendarDays className="h-4 w-4" />
          {formatDate(event.event_date)}
        </span>
        {event.start_time ? (
          <span className="inline-flex items-center gap-1.5">
            <Clock className="h-4 w-4" />
            {formatTime(event.start_time)}
            {event.end_time ? ` – ${formatTime(event.end_time)}` : ""}
          </span>
        ) : null}
        {event.venue ? (
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="h-4 w-4" /> {event.venue}
          </span>
        ) : null}
      </div>

      {event.description ? (
        <p className="mb-6 whitespace-pre-wrap text-sm text-muted-foreground">
          {event.description}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Assignments */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold">
              <Users className="mr-1.5 inline h-4 w-4 text-muted-foreground" />
              Assigned team
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {assignments.length === 0 ? (
              <p className="py-3 text-sm text-muted-foreground">No assignments yet.</p>
            ) : (
              assignments.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between rounded-none border-2 border-foreground px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-medium">{(a as any).member?.full_name ?? "Unknown"}</p>
                    {a.responsibility ? (
                      <p className="text-xs text-muted-foreground">{a.responsibility}</p>
                    ) : null}
                  </div>
                  {(a as any).member?.role ? (
                    <Badge variant="outline" className="text-[10px]">
                      {(a as any).member.role.replace(/_/g, " ")}
                    </Badge>
                  ) : null}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Related scripts */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold">
              <FileText className="mr-1.5 inline h-4 w-4 text-muted-foreground" />
              Related scripts
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {scripts.length === 0 ? (
              <p className="py-3 text-sm text-muted-foreground">No scripts linked yet.</p>
            ) : (
              scripts.map((s) => (
                <Link
                  key={s.id}
                  href={`/scripts/${s.id}`}
                  className="flex items-center justify-between rounded-none border-2 border-foreground px-3 py-2 transition-colors hover:bg-secondary"
                >
                  <p className="truncate text-sm font-medium">{s.title}</p>
                  <ScriptStatusBadge status={s.status} />
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        {/* Run of show preview */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold">
              <ListOrdered className="mr-1.5 inline h-4 w-4 text-muted-foreground" />
              Run of show
            </CardTitle>
            <Button asChild variant="outline" size="sm">
              <Link href={`/run-of-show?event=${id}`}>Open</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {rosItems.length === 0 ? (
              <p className="py-3 text-sm text-muted-foreground">No run-of-show items yet.</p>
            ) : (
              <ol className="space-y-2">
                {rosItems.slice(0, 8).map((item) => (
                  <li key={item.id} className="flex items-start gap-3 rounded-none border-2 border-foreground px-3 py-2">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-none bg-secondary text-[10px] font-bold">
                      {item.sequence}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{item.segment_title}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.start_time ? formatTime(item.start_time) : ""}
                        {(item as any).assignee?.full_name ? ` · ${(item as any).assignee.full_name}` : ""}
                      </p>
                      {item.stage_cue ? (
                        <p className="mt-1 rounded-none bg-stage-cue/10 px-2 py-1 text-xs text-stage-cue">
                          Cue: {item.stage_cue}
                        </p>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Event notes */}
      {event.notes ? (
        <Card className="mt-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Event notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">{event.notes}</p>
          </CardContent>
        </Card>
      ) : null}

      {/* Attendance snapshot */}
      {attendance.length > 0 ? (
        <Card className="mt-4">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold">Attendance</CardTitle>
            <Button asChild variant="outline" size="sm">
              <Link href={`/events/${id}/attendance`}>Manage</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {attendance.map((a) => (
              <div key={a.id} className="flex items-center justify-between text-sm">
                <span>{(a as any).member?.full_name ?? "Unknown"}</span>
                <span className={a.status === "present" ? "text-success font-medium" : "text-muted-foreground"}>
                  {a.status}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

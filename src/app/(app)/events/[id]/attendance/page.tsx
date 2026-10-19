import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Radio, Users, FileDown } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isOfficer } from "@/lib/permissions";
import { formatDateTime, formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckInButton } from "@/components/attendance/check-in-button";
import { ManualCorrectionDialog } from "@/components/attendance/manual-correction-dialog";
import { AttendanceConfigForm } from "./attendance-config-form";

export const metadata = { title: "Attendance" };
export const dynamic = "force-dynamic";

export default async function AttendancePage({
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

  const [attendanceRes, auditRes, assignedRes, membersRes] = await Promise.all([
    supabase
      .from("attendance")
      .select("id, status, method, checked_in_at, distance_m, marked_by, reason, profile_id, member:profiles(full_name, role), marker:marked_by(full_name)")
      .eq("event_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("attendance_audit_log")
      .select("id, profile_id, action, outcome, distance_m, created_at, member:profiles(full_name), actor:actor_id(full_name)")
      .eq("event_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("event_assignments")
      .select("profile_id, member:profiles(id, full_name)")
      .eq("event_id", id),
    supabase
      .from("profiles")
      .select("id, full_name")
      .eq("status", "active")
      .order("full_name"),
  ]);

  const attendance = attendanceRes.data ?? [];
  const auditLog = auditRes.data ?? [];
  const assigned = assignedRes.data ?? [];
  const allMembers = membersRes.data ?? [];

  const myRecord = attendance.find((a) => a.profile_id === user.id);
  const checkedInIds = new Set(attendance.filter((a) => a.status === "present").map((a) => a.profile_id));

  const memberStatuses: Record<string, string> = {};
  for (const a of attendance) {
    memberStatuses[a.profile_id] = a.status;
  }

  const canExport = officer;

  function exportCsv() {
    const rows = [
      ["Name", "Role", "Status", "Method", "Checked In At", "Distance (m)", "Marked By", "Reason"],
      ...attendance.map((a) => [
        (a as any).member?.full_name ?? "",
        (a as any).member?.role ?? "",
        a.status,
        a.method,
        a.checked_in_at ?? "",
        a.distance_m != null ? String(a.distance_m) : "",
        (a as any).marker?.full_name ?? "",
        a.reason ?? "",
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance-${event.name}-${event.event_date}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="mb-4">
        <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
          <Link href={`/events/${id}`}>
            <ArrowLeft className="h-4 w-4" /> Back to event
          </Link>
        </Button>
      </div>

      <PageHeader
        title="Attendance"
        description={`${event.name} · ${formatDate(event.event_date)}`}
        actions={
          canExport && attendance.length > 0 ? (
            <Button variant="outline" size="sm" onClick={exportCsv}>
              <FileDown className="h-4 w-4" /> Export CSV
            </Button>
          ) : undefined
        }
      />

      {/* Check-in card for the logged-in member */}
      {!officer || !checkedInIds.has(user.id) ? (
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">
              <Radio className="mr-1.5 inline h-4 w-4 text-muted-foreground" />
              Your check-in
            </CardTitle>
            <CardDescription>
              {event.attendance_enabled
                ? "Check in when you arrive at the venue."
                : "Attendance has not been enabled for this event."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {event.attendance_enabled ? (
              <CheckInButton eventId={id} alreadyCheckedIn={!!myRecord && myRecord.status === "present"} />
            ) : (
              <p className="text-sm text-muted-foreground">
                An officer needs to enable attendance for this event before check-in opens.
              </p>
            )}
          </CardContent>
        </Card>
      ) : null}

      {/* Officer: attendance config */}
      {officer ? (
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Attendance configuration</CardTitle>
            <CardDescription>
              Set the venue geofence and check-in window. Distance is validated server-side.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AttendanceConfigForm
              eventId={id}
              attendanceEnabled={event.attendance_enabled}
              latitude={event.latitude}
              longitude={event.longitude}
              geofenceRadiusM={event.geofence_radius_m}
              checkInOpensAt={event.check_in_opens_at}
              checkInClosesAt={event.check_in_closes_at}
            />
          </CardContent>
        </Card>
      ) : null}

      {/* Officer: manual correction */}
      {officer ? (
        <div className="mb-6 flex justify-end">
          <ManualCorrectionDialog
            eventId={id}
            members={allMembers}
            currentStatuses={memberStatuses}
          />
        </div>
      ) : null}

      {/* Attendance list */}
      <Card className="mb-6">
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-semibold">
            <Users className="mr-1.5 inline h-4 w-4 text-muted-foreground" />
            Attendance records
          </CardTitle>
          <span className="text-xs text-muted-foreground">
            {checkedInIds.size} / {assigned.length || allMembers.length} present
          </span>
        </CardHeader>
        <CardContent>
          {attendance.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">No attendance records yet.</p>
          ) : (
            <div className="space-y-1.5">
              {attendance.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2 text-sm"
                >
                  <div>
                    <p className="font-medium">{(a as any).member?.full_name ?? "Unknown"}</p>
                    <p className="text-xs text-muted-foreground">
                      {a.method === "gps" ? "GPS" : "Manual"}
                      {a.checked_in_at ? ` · ${formatDateTime(a.checked_in_at)}` : ""}
                      {(a as any).marker ? ` · by ${(a as any).marker.full_name}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {a.reason ? (
                      <span className="max-w-[200px] truncate text-xs text-muted-foreground" title={a.reason}>
                        {a.reason}
                      </span>
                    ) : null}
                    <Badge
                      variant={
                        a.status === "present" ? "success" : a.status === "excused" ? "info" : "secondary"
                      }
                    >
                      {a.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Audit log (officers only, but RLS also enforces) */}
      {officer && auditLog.length > 0 ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Audit log</CardTitle>
            <CardDescription>
              Every check-in attempt and correction is recorded.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {auditLog.map((log) => (
                <div key={log.id} className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {(log.member as any)?.full_name ?? "Unknown"} · {log.action} · {log.outcome.replace(/_/g, " ")}
                    {log.actor ? ` · by ${(log.actor as any).full_name}` : ""}
                  </span>
                  <span>{formatDateTime(log.created_at)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <p className="mt-6 text-xs text-muted-foreground">
        Note: Browser GPS can be inaccurate or spoofed. GPS alone does not prove physical
        presence with certainty — officers can review and correct records manually.
      </p>
    </div>
  );
}

import Link from "next/link";
import { CalendarDays, Plus, MapPin, Clock } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isOfficer } from "@/lib/permissions";
import { formatDate, formatTime, relativeTime } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EventStatusBadge } from "@/components/domain-badges";

export const metadata = { title: "Events" };
export const dynamic = "force-dynamic";

export default async function EventsPage() {
  const user = await requireUser();
  const officer = isOfficer(user.profile.role);
  const supabase = await createClient();

  const today = new Date().toISOString().slice(0, 10);

  const [upcomingRes, pastRes] = await Promise.all([
    supabase
      .from("events")
      .select("id, name, description, event_date, start_time, end_time, venue, status")
      .gte("event_date", today)
      .neq("status", "cancelled")
      .order("event_date", { ascending: true })
      .limit(50),
    supabase
      .from("events")
      .select("id, name, description, event_date, start_time, end_time, venue, status")
      .lt("event_date", today)
      .order("event_date", { ascending: false })
      .limit(20),
  ]);

  const upcoming = upcomingRes.data ?? [];
  const past = pastRes.data ?? [];

  return (
    <div>
      <PageHeader
        title="Events"
        description="College events, responsibilities and event-day coordination."
        actions={
          officer ? (
            <Button asChild size="sm">
              <Link href="/events/new">
                <Plus /> New event
              </Link>
            </Button>
          ) : undefined
        }
      />

      <section className="mb-10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Upcoming
        </h2>
        {upcoming.length === 0 ? (
          <EmptyState
            icon={<CalendarDays className="h-5 w-5" />}
            title="No upcoming events"
            description="Events created by officers will appear here."
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {upcoming.map((event) => (
              <Link key={event.id} href={`/events/${event.id}`}>
                <Card className="tf-card h-full">
                  <CardContent className="space-y-2 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-semibold leading-snug">{event.name}</h3>
                      <EventStatusBadge status={event.status} />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(event.event_date)}
                      {event.start_time ? ` · ${formatTime(event.start_time)}` : ""}
                    </p>
                    {event.venue ? (
                      <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" /> {event.venue}
                      </p>
                    ) : null}
                    {event.description ? (
                      <p className="line-clamp-2 text-xs text-muted-foreground">
                        {event.description}
                      </p>
                    ) : null}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Past
        </h2>
        {past.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">No past events yet.</p>
        ) : (
          <div className="space-y-2">
            {past.map((event) => (
              <Link
                key={event.id}
                href={`/events/${event.id}`}
                className="flex items-center justify-between rounded-none border-2 border-foreground px-4 py-2.5 transition-colors hover:bg-secondary"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{event.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {formatDate(event.event_date)}
                    {event.venue ? ` · ${event.venue}` : ""}
                  </p>
                </div>
                <EventStatusBadge status={event.status} />
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

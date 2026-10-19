import { requireOfficer } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { CreateEventForm } from "./create-event-form";

export const metadata = { title: "New Event" };
export const dynamic = "force-dynamic";

export default async function NewEventPage() {
  await requireOfficer();
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="New event" description="Set up a college event for the team." />
      <CreateEventForm />
    </div>
  );
}

import { requireUser, getActiveMembers } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/layout/page-header";
import { CreateScriptForm } from "./create-script-form";

export const metadata = { title: "New Script" };
export const dynamic = "force-dynamic";

export default async function NewScriptPage() {
  await requireUser();
  const supabase = await createClient();

  const { data: events } = await supabase
    .from("events")
    .select("id, name, event_date")
    .neq("status", "cancelled")
    .order("event_date", { ascending: false })
    .limit(50);

  const members = await getActiveMembers();

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="New script" description="Start a new anchoring script draft." />
      <CreateScriptForm
        events={events ?? []}
        members={members.map((m) => ({ id: m.id, full_name: m.full_name }))}
      />
    </div>
  );
}

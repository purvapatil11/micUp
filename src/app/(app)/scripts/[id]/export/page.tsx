import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ScriptExport } from "./script-export";
import type { ScriptStatus, ScriptCategory } from "@/types/database";

export const metadata = { title: "Export script" };
export const dynamic = "force-dynamic";

export default async function ScriptExportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireUser();
  const supabase = await createClient();

  const { data: script } = await supabase
    .from("scripts")
    .select(
      "id, title, content, status, category, deadline, updated_at, events(name, event_date), creator:created_by(full_name)"
    )
    .eq("id", id)
    .maybeSingle();

  if (!script) notFound();

  const event = (script as any).events;

  return (
    <ScriptExport
      script={{
        id: script.id,
        title: script.title,
        content: script.content,
        status: script.status as ScriptStatus,
        category: script.category as ScriptCategory,
        deadline: script.deadline,
        updated_at: script.updated_at,
        event: event ? { name: event.name, event_date: event.event_date } : null,
        creatorName: (script as any).creator?.full_name ?? null,
      }}
    />
  );
}

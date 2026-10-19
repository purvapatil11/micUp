"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { createScriptAction } from "@/actions/scripts";
import { SCRIPT_CATEGORIES, SCRIPT_CATEGORY_LABELS } from "@/types/database";

export function CreateScriptForm({
  events,
  members,
}: {
  events: { id: string; name: string; event_date: string }[];
  members: { id: string; full_name: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<string>("opening");
  const [eventId, setEventId] = useState<string>("none");
  const [assignedTo, setAssignedTo] = useState<string[]>([]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    const title = String(form.get("title") ?? "");
    const deadlineRaw = String(form.get("deadline") ?? "");
    const deadline = deadlineRaw || null;

    startTransition(async () => {
      const result = await createScriptAction({
        title,
        eventId: eventId === "none" ? null : eventId,
        category,
        assignedTo,
        deadline,
      });
      if (!result.ok) {
        setError(result.error ?? "Could not create script.");
        return;
      }
      toast.success("Script created");
      router.push(`/scripts/${result.id}`);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              name="title"
              required
              minLength={2}
              maxLength={200}
              placeholder="e.g. Welcome speech for Annual Day"
              disabled={pending}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory} disabled={pending}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SCRIPT_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {SCRIPT_CATEGORY_LABELS[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="deadline">Deadline (optional)</Label>
              <Input
                id="deadline"
                name="deadline"
                type="date"
                disabled={pending}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Event (optional)</Label>
            <Select value={eventId} onValueChange={setEventId} disabled={pending}>
              <SelectTrigger>
                <SelectValue placeholder="No event" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No event</SelectItem>
                {events.map((ev) => (
                  <SelectItem key={ev.id} value={ev.id}>
                    {ev.name} · {ev.event_date}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Assigned anchors</Label>
            <div className="max-h-48 overflow-y-auto rounded-lg border border-border p-3 space-y-1.5">
              {members.map((m) => (
                <label key={m.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-border"
                    checked={assignedTo.includes(m.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setAssignedTo((prev) => [...prev, m.id]);
                      } else {
                        setAssignedTo((prev) => prev.filter((id) => id !== m.id));
                      }
                    }}
                    disabled={pending}
                  />
                  {m.full_name}
                </label>
              ))}
            </div>
          </div>

          {error ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => router.back()} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : null}
              {pending ? "Creating…" : "Create draft"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

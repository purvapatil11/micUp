"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { createEventAction } from "@/actions/events";
import { EVENT_STATUSES, EVENT_STATUS_LABELS } from "@/types/database";

export function CreateEventForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("upcoming");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    const name = String(form.get("name") ?? "");
    const description = String(form.get("description") ?? "") || null;
    const eventDate = String(form.get("eventDate") ?? "");
    const startTime = String(form.get("startTime") ?? "") || null;
    const endTime = String(form.get("endTime") ?? "") || null;
    const venue = String(form.get("venue") ?? "") || null;
    const notes = String(form.get("notes") ?? "") || null;

    startTransition(async () => {
      const result = await createEventAction({
        name,
        description,
        eventDate,
        startTime,
        endTime,
        venue,
        status,
        notes,
      });
      if (!result.ok) {
        setError(result.error ?? "Could not create event.");
        return;
      }
      toast.success("Event created");
      router.push(`/events/${result.id}`);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Event name</Label>
            <Input id="name" name="name" required minLength={2} maxLength={160} disabled={pending} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" rows={3} disabled={pending} />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="eventDate">Date</Label>
              <Input id="eventDate" name="eventDate" type="date" required disabled={pending} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="startTime">Start time</Label>
              <Input id="startTime" name="startTime" type="time" disabled={pending} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endTime">End time</Label>
              <Input id="endTime" name="endTime" type="time" disabled={pending} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="venue">Venue</Label>
              <Input id="venue" name="venue" maxLength={200} disabled={pending} />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus} disabled={pending}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {EVENT_STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" name="notes" rows={3} disabled={pending} />
          </div>

          {error ? (
            <p className="rounded-none border-2 border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => router.back()} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : null}
              {pending ? "Creating…" : "Create event"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

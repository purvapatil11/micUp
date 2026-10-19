"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteEventAction } from "@/actions/events";

export function DeleteEventButton({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    if (
      !confirm(
        "Delete this event permanently? Its run-of-show items, assignments and attendance records will be removed too."
      )
    ) {
      return;
    }
    startTransition(async () => {
      const result = await deleteEventAction({ eventId });
      if (!result.ok) {
        toast.error(result.error ?? "Failed to delete event.");
        return;
      }
      toast.success("Event deleted");
      router.push("/events");
      router.refresh();
    });
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleDelete}
      disabled={pending}
      className="text-destructive hover:bg-destructive/10"
    >
      <Trash2 className="h-4 w-4" /> {pending ? "Deleting…" : "Delete"}
    </Button>
  );
}

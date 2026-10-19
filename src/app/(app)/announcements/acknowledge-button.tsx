"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { acknowledgeAnnouncementAction } from "@/actions/announcements";

export function AcknowledgeButton({ announcementId }: { announcementId: string }) {
  const [pending, startTransition] = useTransition();

  function handleAck() {
    startTransition(async () => {
      const result = await acknowledgeAnnouncementAction({ announcementId });
      if (!result.ok) {
        toast.error(result.error ?? "Failed to acknowledge.");
        return;
      }
      toast.success("Acknowledged");
      window.location.reload();
    });
  }

  return (
    <Button variant="outline" size="sm" onClick={handleAck} disabled={pending}>
      {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
      {pending ? "…" : "Acknowledge"}
    </Button>
  );
}

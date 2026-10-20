"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteAnnouncementAction } from "@/actions/announcements";

export function DeleteAnnouncementButton({ announcementId }: { announcementId: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleDelete() {
    if (!confirm("Delete this announcement?")) return;
    startTransition(async () => {
      const result = await deleteAnnouncementAction({ announcementId });
      if (!result.ok) {
        toast.error(result.error ?? "Failed to delete announcement.");
        return;
      }
      toast.success("Announcement deleted");
      router.refresh();
    });
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleDelete}
      disabled={pending}
      className="text-muted-foreground hover:text-destructive"
    >
      {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
    </Button>
  );
}

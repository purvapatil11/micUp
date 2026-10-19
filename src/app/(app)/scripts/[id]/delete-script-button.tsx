"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteScriptAction } from "@/actions/scripts";

export function DeleteScriptButton({ scriptId }: { scriptId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    if (!confirm("Delete this script permanently? Its revisions and discussions will be removed too.")) {
      return;
    }
    startTransition(async () => {
      const result = await deleteScriptAction({ scriptId });
      if (!result.ok) {
        toast.error(result.error ?? "Failed to delete script.");
        return;
      }
      toast.success("Script deleted");
      router.push("/scripts");
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

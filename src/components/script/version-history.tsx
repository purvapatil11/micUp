"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { History, RotateCcw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { restoreScriptVersionAction } from "@/actions/scripts";
import { formatDateTime } from "@/lib/utils";
import { ScriptStatusBadge } from "@/components/domain-badges";
import { ScriptContent } from "@/components/script/script-content";

interface Version {
  id: string;
  revision: number;
  title: string;
  content: any;
  status: string;
  note: string | null;
  created_at: string;
  author: { full_name: string } | null;
}

export function VersionHistory({
  scriptId,
  versions,
  isOfficer,
}: {
  scriptId: string;
  versions: Version[];
  isOfficer: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Version | null>(null);
  const [pending, startTransition] = useTransition();

  function handleRestore(versionId: string) {
    startTransition(async () => {
      const result = await restoreScriptVersionAction({ scriptId, versionId });
      if (!result.ok) {
        toast.error(result.error ?? "Failed to restore version.");
        return;
      }
      toast.success("Version restored as a new revision");
      setOpen(false);
      setSelected(null);
      window.location.reload();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <History className="h-4 w-4" /> Version history
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Version history</DialogTitle>
          <DialogDescription>
            {versions.length} revision{versions.length === 1 ? "" : "s"} recorded.
            {isOfficer ? " Restoring creates a new revision — history is never deleted." : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {versions.map((v) => (
            <div
              key={v.id}
                className={`rounded-none border-2 p-3 transition-colors ${
                  selected?.id === v.id ? "border-foreground bg-secondary" : "border-foreground bg-background hover:bg-secondary"
                }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    rev {v.revision} · {v.title}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {v.author?.full_name ?? "Unknown"} · {formatDateTime(v.created_at)}
                  </p>
                  {v.note ? (
                    <p className="mt-1 text-xs italic text-muted-foreground">&quot;{v.note}&quot;</p>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <ScriptStatusBadge status={v.status as any} />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelected(selected?.id === v.id ? null : v)}
                  >
                    View
                  </Button>
                  {isOfficer ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRestore(v.id)}
                      disabled={pending}
                    >
                      {pending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RotateCcw className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  ) : null}
                </div>
              </div>

              {selected?.id === v.id ? (
                <div className="mt-3 rounded-none border-2 border-foreground bg-background p-3">
                  <ScriptContent content={v.content} />
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

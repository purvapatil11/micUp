"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { correctAttendanceAction } from "@/actions/attendance";

export function ManualCorrectionDialog({
  eventId,
  members,
  currentStatuses,
}: {
  eventId: string;
  members: { id: string; full_name: string }[];
  currentStatuses: Record<string, string>;
}) {
  const [open, setOpen] = useState(false);
  const [profileId, setProfileId] = useState("");
  const [status, setStatus] = useState("present");
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function handleSubmit() {
    if (!profileId) {
      setError("Select a member.");
      return;
    }
    if (reason.trim().length < 3) {
      setError("Please provide a reason (at least 3 characters).");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await correctAttendanceAction({
        eventId,
        profileId,
        status,
        reason: reason.trim(),
      });
      if (!result.ok) {
        setError(result.error ?? "Failed to correct attendance.");
        return;
      }
      toast.success("Attendance corrected");
      setOpen(false);
      setProfileId("");
      setStatus("present");
      setReason("");
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <UserCheck className="h-4 w-4" /> Manual correction
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Manual attendance correction</DialogTitle>
          <DialogDescription>
            Record or fix attendance when GPS check-in is not possible.
            This is audited with your name, the reason and a timestamp.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Member</Label>
            <Select value={profileId} onValueChange={setProfileId}>
              <SelectTrigger>
                <SelectValue placeholder="Select member" />
              </SelectTrigger>
              <SelectContent>
                {members.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.full_name}
                    {currentStatuses[m.id] ? ` · currently ${currentStatuses[m.id]}` : " · no record"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="present">Present</SelectItem>
                <SelectItem value="absent">Absent</SelectItem>
                <SelectItem value="excused">Excused</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Reason</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="e.g. GPS unavailable at venue, member arrived by 5pm call time"
            />
          </div>

          {error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : null}
              {pending ? "Saving…" : "Apply correction"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

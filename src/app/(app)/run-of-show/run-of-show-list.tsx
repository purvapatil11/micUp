"use client";

import { useState, useTransition, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  GripVertical,
  Clock,
  Loader2,
  Save,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  upsertRunOfShowItemAction,
  deleteRunOfShowItemAction,
  reorderRunOfShowAction,
} from "@/actions/run-of-show";

interface RosItem {
  id: string;
  sequence: number;
  start_time: string | null;
  segment_title: string;
  description: string | null;
  stage_cue: string | null;
  notes: string | null;
  assigned_to: string | null;
  script_id: string | null;
  assignee?: { full_name: string } | null;
  script?: { id: string; title: string; status: string } | null;
}

export function RunOfShowList({
  eventId,
  items: initialItems,
  isOfficer,
  showAddParam,
  members,
  scripts,
}: {
  eventId: string;
  items: RosItem[];
  isOfficer: boolean;
  showAddParam?: boolean;
  members?: { id: string; full_name: string }[];
  scripts?: { id: string; title: string }[];
}) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<RosItem | null>(null);
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    startTime: "",
    segmentTitle: "",
    description: "",
    stageCue: "",
    notes: "",
    assignedTo: "none",
    scriptId: "none",
  });

  const resetForm = useCallback(() => {
    setForm({
      startTime: "",
      segmentTitle: "",
      description: "",
      stageCue: "",
      notes: "",
      assignedTo: "none",
      scriptId: "none",
    });
    setEditing(null);
  }, []);

  // Open the add dialog when the page linked here with ?new=1, then strip
  // the param so a reload doesn't immediately reopen it.
  const openedForParam = useRef(false);
  useEffect(() => {
    if (!showAddParam || openedForParam.current) return;
    openedForParam.current = true;
    resetForm();
    setOpen(true);
    const url = new URL(window.location.href);
    url.searchParams.delete("new");
    window.history.replaceState(null, "", url.toString());
  }, [showAddParam, resetForm]);

  function openAdd() {
    resetForm();
    setOpen(true);
  }

  function openEdit(item: RosItem) {
    setEditing(item);
    setForm({
      startTime: item.start_time ? item.start_time.slice(0, 5) : "",
      segmentTitle: item.segment_title,
      description: item.description ?? "",
      stageCue: item.stage_cue ?? "",
      notes: item.notes ?? "",
      assignedTo: item.assigned_to ?? "none",
      scriptId: item.script_id ?? "none",
    });
    setOpen(true);
  }

  function handleSave() {
    if (!form.segmentTitle.trim()) {
      toast.error("Segment title is required.");
      return;
    }
    startTransition(async () => {
      const result = await upsertRunOfShowItemAction({
        eventId,
        itemId: editing?.id ?? null,
        startTime: form.startTime || null,
        segmentTitle: form.segmentTitle.trim(),
        description: form.description.trim() || null,
        stageCue: form.stageCue.trim() || null,
        notes: form.notes.trim() || null,
        assignedTo: form.assignedTo === "none" ? null : form.assignedTo,
        scriptId: form.scriptId === "none" ? null : form.scriptId,
      });
      if (!result.ok) {
        toast.error(result.error ?? "Failed to save item.");
        return;
      }
      toast.success(editing ? "Item updated" : "Item added");
      setOpen(false);
      resetForm();
      window.location.reload();
    });
  }

  function handleDelete(itemId: string) {
    if (!confirm("Delete this run-of-show item?")) return;
    startTransition(async () => {
      const result = await deleteRunOfShowItemAction({ eventId, itemId });
      if (!result.ok) {
        toast.error(result.error ?? "Failed to delete item.");
        return;
      }
      setItems((prev) => prev.filter((i) => i.id !== itemId));
      toast.success("Item deleted");
    });
  }

  function moveItem(index: number, direction: -1 | 1) {
    const next = [...items];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setItems(next);
    startTransition(async () => {
      const result = await reorderRunOfShowAction({
        eventId,
        orderedItemIds: next.map((i) => i.id),
      });
      if (!result.ok) {
        toast.error(result.error ?? "Failed to reorder.");
        window.location.reload();
      }
    });
  }

  return (
    <div>
      {isOfficer ? (
        <div className="mb-4 flex justify-end">
          <Button size="sm" onClick={openAdd}>
            <Plus className="h-4 w-4" /> Add item
          </Button>
        </div>
      ) : null}

      <ol className="space-y-3">
        {items.map((item, idx) => (
          <li
            key={item.id}
            className="tf-card rounded-none border-2 border-foreground bg-background p-4 transition-colors hover:bg-secondary"
          >
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-none border-2 border-foreground bg-secondary text-xs font-bold">
                {item.sequence}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold">{item.segment_title}</h3>
                  {item.start_time ? (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {item.start_time.slice(0, 5)}
                    </span>
                  ) : null}
                  {item.assignee ? (
                    <span className="text-xs text-muted-foreground">
                      · {item.assignee.full_name}
                    </span>
                  ) : null}
                  {item.script ? (
                    <a
                      href={`/scripts/${item.script.id}`}
                      className="text-xs text-primary hover:underline"
                    >
                      ↳ {item.script.title}
                    </a>
                  ) : null}
                </div>
                {item.description ? (
                  <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                ) : null}
                {item.stage_cue ? (
                  <p className="mt-2 rounded-none border-2 border-l-4 border-stage-cue bg-stage-cue/10 px-3 py-1.5 text-xs text-stage-cue">
                    <span className="font-semibold">Stage cue:</span> {item.stage_cue}
                  </p>
                ) : null}
                {item.notes ? (
                  <p className="mt-1 text-xs italic text-muted-foreground">Notes: {item.notes}</p>
                ) : null}
              </div>

              {isOfficer ? (
                <div className="flex shrink-0 flex-col gap-1">
                  <button
                    type="button"
                    onClick={() => moveItem(idx, -1)}
                    disabled={idx === 0 || pending}
                    className="rounded-none p-1 text-muted-foreground hover:bg-secondary disabled:opacity-30"
                    aria-label="Move up"
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveItem(idx, 1)}
                    disabled={idx === items.length - 1 || pending}
                    className="rounded-none p-1 text-muted-foreground hover:bg-secondary disabled:opacity-30"
                    aria-label="Move down"
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => openEdit(item)}
                    className="rounded-none p-1 text-muted-foreground hover:bg-secondary"
                    aria-label="Edit"
                  >
                    <Save className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(item.id)}
                    disabled={pending}
                    className="rounded-none p-1 text-muted-foreground hover:bg-destructive/20 hover:text-destructive"
                    aria-label="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : null}
            </div>
          </li>
        ))}
      </ol>

      {/* Add/Edit dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit item" : "Add run-of-show item"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="ros-title">Segment title</Label>
                <Input
                  id="ros-title"
                  value={form.segmentTitle}
                  onChange={(e) => setForm((f) => ({ ...f, segmentTitle: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ros-time">Start time</Label>
                <Input
                  id="ros-time"
                  type="time"
                  value={form.startTime}
                  onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ros-desc">Description</Label>
              <Textarea
                id="ros-desc"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ros-cue">Stage cue / technical instruction</Label>
              <Textarea
                id="ros-cue"
                value={form.stageCue}
                onChange={(e) => setForm((f) => ({ ...f, stageCue: e.target.value }))}
                rows={2}
                placeholder="e.g. Dim lights, play walk-in music, cue slide 3"
              />
            </div>

            {members && members.length > 0 ? (
              <div className="space-y-2">
                <Label>Assigned to</Label>
                <select
                  className="w-full rounded-none border-2 border-input bg-background px-3 py-2 text-sm"
                  value={form.assignedTo}
                  onChange={(e) => setForm((f) => ({ ...f, assignedTo: e.target.value }))}
                >
                  <option value="none">— None —</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.full_name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {scripts && scripts.length > 0 ? (
              <div className="space-y-2">
                <Label>Related script</Label>
                <select
                  className="w-full rounded-none border-2 border-input bg-background px-3 py-2 text-sm"
                  value={form.scriptId}
                  onChange={(e) => setForm((f) => ({ ...f, scriptId: e.target.value }))}
                >
                  <option value="none">— None —</option>
                  {scripts.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="ros-notes">Notes</Label>
              <Textarea
                id="ros-notes"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={pending}>
                {pending ? <Loader2 className="animate-spin" /> : null}
                {editing ? "Update" : "Add item"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

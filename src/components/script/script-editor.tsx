"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import CharacterCount from "@tiptap/extension-character-count";
import { toast } from "sonner";
import { Save, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { saveScriptAction } from "@/actions/scripts";
import { SCRIPT_STATUSES, SCRIPT_STATUS_LABELS } from "@/types/database";
import { allowedStatusTransitions } from "@/lib/permissions";
import { relativeTime } from "@/lib/utils";

type SaveState = "idle" | "saving" | "saved" | "error" | "conflict";

interface EditorProps {
  scriptId: string;
  title: string;
  content: any;
  status: string;
  revision: number;
  updatedAt: string;
  updatedByName: string | null;
  role: string;
}

export function ScriptEditor({
  scriptId,
  title: initialTitle,
  content: initialContent,
  status: initialStatus,
  revision: initialRevision,
  updatedAt,
  updatedByName,
  role,
}: EditorProps) {
  const [title, setTitle] = useState(initialTitle);
  const [status, setStatus] = useState(initialStatus);
  const [revision, setRevision] = useState(initialRevision);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [conflictInfo, setConflictInfo] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirtyRef = useRef(false);
  const revisionRef = useRef(initialRevision);

  const allowedStatuses = allowedStatusTransitions(role as any);

  const doSave = useCallback(
    async (opts?: { force?: boolean; manualNote?: string | null }) => {
      const editorInstance = editorRef.current;
      if (!editorInstance) return;

      setSaveState("saving");
      const json = editorInstance.getJSON();

      const result = await saveScriptAction(
        {
          scriptId,
          baseRevision: revisionRef.current,
          title,
          content: json,
          status,
          note: opts?.manualNote ?? null,
        },
        { force: opts?.force }
      );

      if (result.ok) {
        setSaveState("saved");
        setConflictInfo(null);
        setRevision(result.revision ?? revisionRef.current);
        revisionRef.current = result.revision ?? revisionRef.current;
        setLastSavedAt(result.updatedAt ?? new Date().toISOString());
        dirtyRef.current = false;
      } else if (result.error?.includes("Conflict")) {
        setSaveState("conflict");
        setConflictInfo(result.error);
      } else {
        setSaveState("error");
        toast.error(result.error ?? "Save failed");
      }
    },
    [scriptId, title, status]
  );

  // Debounced autosave
  useEffect(() => {
    if (!dirtyRef.current) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      doSave();
    }, 1500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [title, status, revision, doSave]);

  // Warn before leaving with unsaved changes
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: "Start writing your script…" }),
      CharacterCount,
    ],
    content: initialContent ?? { type: "doc", content: [] },
    onUpdate: () => {
      dirtyRef.current = true;
    },
    editorProps: {
      attributes: {
        class: "min-h-[24rem] focus:outline-none",
      },
    },
  });

  const editorRef = useRef(editor);
  editorRef.current = editor;

  const handleManualSave = () => {
    doSave({ manualNote: note.trim() || null });
    setNote("");
  };

  const handleForceReload = () => {
    window.location.reload();
  };

  const handleForceSave = async () => {
    const editorInstance = editorRef.current;
    if (!editorInstance) return;
    setSaveState("saving");
    const json = editorInstance.getJSON();
    const result = await saveScriptAction(
      {
        scriptId,
        baseRevision: revisionRef.current,
        title,
        content: json,
        status,
        note: note.trim() || null,
      },
      { force: true }
    );
    if (result.ok) {
      setSaveState("saved");
      setConflictInfo(null);
      setRevision(result.revision ?? revisionRef.current);
      revisionRef.current = result.revision ?? revisionRef.current;
      dirtyRef.current = false;
      toast.success("Saved (overwrote conflicting changes)");
    } else {
      setSaveState("error");
      toast.error(result.error ?? "Save failed");
    }
  };

  if (!editor) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading editor…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Title */}
      <div className="space-y-2">
        <Label htmlFor="script-title">Title</Label>
        <Input
          id="script-title"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            dirtyRef.current = true;
          }}
          className="text-lg font-semibold"
          maxLength={200}
        />
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-border bg-secondary/40 p-1.5">
        {(
          [
            ["Bold", () => editor.chain().focus().toggleBold().run(), editor.isActive("bold")],
            ["Italic", () => editor.chain().focus().toggleItalic().run(), editor.isActive("italic")],
            ["H1", () => editor.chain().focus().toggleHeading({ level: 1 }).run(), editor.isActive("heading", { level: 1 })],
            ["H2", () => editor.chain().focus().toggleHeading({ level: 2 }).run(), editor.isActive("heading", { level: 2 })],
            ["H3", () => editor.chain().focus().toggleHeading({ level: 3 }).run(), editor.isActive("heading", { level: 3 })],
            ["• List", () => editor.chain().focus().toggleBulletList().run(), editor.isActive("bulletList")],
            ["1. List", () => editor.chain().focus().toggleOrderedList().run(), editor.isActive("orderedList")],
            ["Quote", () => editor.chain().focus().toggleBlockquote().run(), editor.isActive("blockquote")],
          ] as const
        ).map(([label, cmd, active]) => (
          <button
            key={label}
            type="button"
            onClick={cmd}
            className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
              active ? "bg-primary/20 text-primary" : "text-muted-foreground hover:bg-secondary"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Status row */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card/60 p-3">
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Status</Label>
          <Select
            value={status}
            onValueChange={(v) => {
              setStatus(v);
              dirtyRef.current = true;
            }}
          >
            <SelectTrigger className="w-36 h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SCRIPT_STATUSES.map((s) => (
                <SelectItem key={s} value={s} disabled={!allowedStatuses.includes(s) && s !== status}>
                  {SCRIPT_STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>rev {revision}</span>
          <span>·</span>
          <span>
            {saveState === "saving" ? (
              <span className="inline-flex items-center gap-1 text-info">
                <Loader2 className="h-3 w-3 animate-spin" /> Saving…
              </span>
            ) : saveState === "saved" ? (
              <span className="text-success">Saved {relativeTime(lastSavedAt ?? updatedAt)}</span>
            ) : saveState === "error" ? (
              <span className="text-destructive">Save failed</span>
            ) : saveState === "conflict" ? (
              <span className="text-warning">Conflict detected</span>
            ) : (
              <span>Autosave on</span>
            )}
          </span>
          <span>·</span>
          <span>
            {updatedByName ? `Last edit by ${updatedByName}` : "New script"}
          </span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Version note (optional)"
            className="h-8 w-44 text-xs"
            maxLength={300}
          />
          <Button size="sm" variant="outline" onClick={handleManualSave} disabled={saveState === "saving"}>
            <Save className="h-3.5 w-3.5" /> Save
          </Button>
        </div>
      </div>

      {/* Conflict banner */}
      {conflictInfo ? (
        <div className="flex flex-col gap-2 rounded-lg border border-warning/40 bg-warning/10 p-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2 text-sm text-warning-foreground">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{conflictInfo}</span>
          </div>
          <div className="flex gap-2 sm:ml-auto">
            <Button size="sm" variant="outline" onClick={handleForceReload}>
              Reload newer version
            </Button>
            <Button size="sm" variant="destructive" onClick={handleForceSave}>
              Overwrite with mine
            </Button>
          </div>
        </div>
      ) : null}

      {/* Editor */}
      <div className="rounded-lg border border-border bg-card/60">
        <EditorContent editor={editor} className="tiptap-editor" />
      </div>

      {/* Character count */}
      <p className="text-right text-xs text-muted-foreground">
        {editor.storage.characterCount.characters()} characters
      </p>
    </div>
  );
}

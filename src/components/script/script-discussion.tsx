"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { MessageSquare, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { createCommentAction, deleteCommentAction } from "@/actions/script-comments";
import { initials, relativeTime } from "@/lib/utils";
import type { Profile } from "@/types/database";

interface Comment {
  id: string;
  body: string;
  created_at: string;
  author_id: string;
  author: { full_name: string } | null;
}

export function ScriptDiscussion({
  scriptId,
  comments: initialComments,
  profile,
}: {
  scriptId: string;
  comments: Comment[];
  profile: Profile;
}) {
  const [comments, setComments] = useState(initialComments);
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Sync state when the server re-renders with fresh data (e.g. after
  // a mutation + revalidatePath). Realtime handles live inserts/deletes.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setComments(initialComments);
  }, [initialComments]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [comments.length]);

  // Realtime subscription
  useEffect(() => {
    let mounted = true;
    let channel: any = null;

    (async () => {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      channel = supabase
        .channel(`script-comments-${scriptId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "script_comments",
            filter: `script_id=eq.${scriptId}`,
          },
          (payload: any) => {
            if (!mounted) return;
            setComments((prev) => {
              if (prev.some((c) => c.id === payload.new.id)) return prev;
              return [...prev, payload.new as Comment];
            });
          }
        )
        .on(
          "postgres_changes",
          {
            event: "DELETE",
            schema: "public",
            table: "script_comments",
          },
          (payload: any) => {
            if (!mounted) return;
            setComments((prev) => prev.filter((c) => c.id !== payload.old?.id));
          }
        )
        .subscribe();
    })();

    return () => {
      mounted = false;
      if (channel) {
        (async () => {
          const { createClient } = await import("@/lib/supabase/client");
          const supabase = createClient();
          await supabase.removeChannel(channel);
        })();
      }
    };
  }, [scriptId]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setError(null);
    startTransition(async () => {
      const result = await createCommentAction({ scriptId, body: body.trim() });
      if (!result.ok) {
        setError(result.error ?? "Failed to post comment.");
        return;
      }
      setBody("");
      // Optimistically add (realtime will dedupe by id)
      toast.success("Comment posted");
    });
  }

  function handleDelete(commentId: string) {
    startTransition(async () => {
      const result = await deleteCommentAction({ commentId });
      if (!result.ok) {
        toast.error(result.error ?? "Failed to delete comment.");
        return;
      }
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    });
  }

  return (
    <div className="space-y-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <MessageSquare className="h-4 w-4 text-muted-foreground" />
        Script discussion
        <span className="text-xs font-normal text-muted-foreground">({comments.length})</span>
      </h3>

      <div className="max-h-96 space-y-3 overflow-y-auto rounded-lg border border-border bg-card/40 p-4">
        {comments.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No comments yet. Start the conversation.
          </p>
        ) : (
          comments.map((comment) => (
            <div key={comment.id} className="flex gap-2.5 group">
              <Avatar className="h-7 w-7 shrink-0">
                <AvatarFallback className="text-[10px]">
                  {initials(comment.author?.full_name ?? "?")}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold">
                    {comment.author?.full_name ?? "Unknown"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {relativeTime(comment.created_at)}
                  </span>
                  {comment.author_id === profile.id ||
                  ["anchoring_officer", "deputy_anchoring_officer"].includes(profile.role) ? (
                    <button
                      type="button"
                      onClick={() => handleDelete(comment.id)}
                      disabled={pending}
                      className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                      aria-label="Delete comment"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </div>
                <p className="mt-0.5 whitespace-pre-wrap break-words text-sm">
                  {comment.body}
                </p>
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSubmit} className="space-y-2">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Add a comment about this script…"
          rows={3}
          maxLength={4000}
          disabled={pending}
        />
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : null}
        <div className="flex justify-end">
          <Button type="submit" size="sm" disabled={pending || !body.trim()}>
            {pending ? <Loader2 className="animate-spin" /> : null}
            {pending ? "Posting…" : "Post comment"}
          </Button>
        </div>
      </form>
    </div>
  );
}

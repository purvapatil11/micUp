"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";

export function ScriptContent({
  content,
  onReady,
}: {
  content: any;
  onReady?: () => void;
}) {
  const editor = useEditor({
    editable: false,
    extensions: [StarterKit, Placeholder.configure({ placeholder: "" })],
    content: content ?? { type: "doc", content: [] },
    onCreate: () => onReady?.(),
  });

  if (!editor) return null;

  return (
    <div className="script-content tiptap-editor">
      <EditorContent editor={editor} />
    </div>
  );
}

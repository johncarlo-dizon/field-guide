"use client";

import type { CSSProperties, MouseEvent } from "react";
import { useEffect, useRef } from "react";
import { EditorContent, useEditor, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Highlight from "@tiptap/extension-highlight";
import { docToText, textToDoc } from "@/lib/richtext";
import { ui } from "@/lib/ui";

type Props = {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
};

const tool: CSSProperties = {
  ...ui.btn, ...ui.small, minWidth: 38, height: 34, padding: "0 10px",
  display: "inline-flex", alignItems: "center", justifyContent: "center",
};

const keep = (e: MouseEvent) => e.preventDefault(); // clicking a tool keeps the selection in the editor

export default function TextEditor({ value, onChange, placeholder, autoFocus }: Props) {
  const last = useRef(value); // the text we last loaded or sent out
  const cb = useRef(onChange);
  cb.current = onChange;

  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    autofocus: autoFocus ? "end" : false,
    extensions: [
      StarterKit.configure({
        heading: false,
        blockquote: false,
        codeBlock: false,
        code: false,
        horizontalRule: false,
        orderedList: false,
        italic: false,
        strike: false,
        underline: false,
        link: false,
      }),
      Highlight,
    ],
    content: textToDoc(value) as JSONContent,
    editorProps: {
      attributes: {
        class: "fg-editor",
        role: "textbox",
        "aria-multiline": "true",
        "aria-label": placeholder ?? "Text",
      },
    },
    onUpdate: ({ editor: ed }) => {
      const t = docToText(ed.getJSON());
      last.current = t;
      cb.current(t);
    },
  });

  // If the parent changes the text (for example Cancel clears it), show the new text.
  useEffect(() => {
    if (!editor || value === last.current) return;
    last.current = value;
    editor.commands.setContent(textToDoc(value) as JSONContent, { emitUpdate: false });
  }, [value, editor]);

  const on = (name: string) => !!editor?.isActive(name);
  const look = (active: boolean, disabled = false): CSSProperties => ({
    ...tool,
    ...(active ? ui.dark : {}),
    opacity: disabled ? 0.4 : 1,
  });
  const canUndo = !!editor?.can().undo();
  const canRedo = !!editor?.can().redo();

  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
        <button
          type="button" title="Bold (Ctrl+B)" aria-label="Bold" onMouseDown={keep}
          onClick={() => editor?.chain().focus().toggleBold().run()}
          style={{ ...look(on("bold")), fontWeight: 800 }}
        >
          B
        </button>
        <button
          type="button" title="Highlight" aria-label="Highlight" onMouseDown={keep}
          onClick={() => editor?.chain().focus().toggleHighlight().run()}
          style={look(on("highlight"))}
        >
          <span style={{ background: "#fff3a3", color: "#171717", padding: "1px 6px", borderRadius: 4, fontWeight: 700 }}>H</span>
        </button>
        <button
          type="button" title="Bullet list" aria-label="Bullet list" onMouseDown={keep}
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
          style={look(on("bulletList"))}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <circle cx="4" cy="6" r="1" />
            <circle cx="4" cy="12" r="1" />
            <circle cx="4" cy="18" r="1" />
            <path d="M9 6h12M9 12h12M9 18h12" />
          </svg>
        </button>
        <button
          type="button" title="Undo (Ctrl+Z)" aria-label="Undo" onMouseDown={keep} disabled={!canUndo}
          onClick={() => editor?.chain().focus().undo().run()}
          style={look(false, !canUndo)}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 14 4 9l5-5" />
            <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
          </svg>
        </button>
        <button
          type="button" title="Redo (Ctrl+Y)" aria-label="Redo" onMouseDown={keep} disabled={!canRedo}
          onClick={() => editor?.chain().focus().redo().run()}
          style={look(false, !canRedo)}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m15 14 5-5-5-5" />
            <path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" />
          </svg>
        </button>
      </div>

      <div className="fg-edit-wrap">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
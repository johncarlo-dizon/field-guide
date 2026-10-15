"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

export type Status = "draft" | "verified" | "outdated";
export type InitialBlock = {
  type: "text" | "image";
  content: string;
  caption: string;
  attachmentId: string | null;
};
export type Initial = { title: string; status: Status; blocks: InitialBlock[] };
export type Payload = {
  title: string;
  status: Status;
  blocks: (
    | { type: "text"; content: string }
    | { type: "image"; attachmentId: string; caption: string }
  )[];
};

type B =
  | { key: number; type: "text"; content: string }
  | { key: number; type: "image"; attachmentId: string; caption: string };

type Props = {
  heading: string;
  backHref: string;
  backLabel: string;
  submitLabel: string;
  showStatus?: boolean;
  initial?: Initial;
  // Return an error message to show, or null when saved (the page then navigates away)
  onSubmit: (p: Payload) => Promise<string | null>;
};

const card = {
  background: "#fff", border: "1px solid #d9d6cc", borderRadius: 14, padding: 16, margin: "12px 0",
} as const;
const field = {
  width: "100%", padding: 10, borderRadius: 10, border: "1px solid #d9d6cc",
  marginTop: 6, boxSizing: "border-box", font: "inherit",
} as const;
const btn = { padding: "8px 14px", borderRadius: 10, border: "1px solid #d9d6cc", background: "#fff", cursor: "pointer" } as const;

export default function ErrorForm({
  heading, backHref, backLabel, submitLabel, showStatus, initial, onSubmit,
}: Props) {
  const nextKey = useRef(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [status, setStatus] = useState<Status>(initial?.status ?? "draft");
  const [blocks, setBlocks] = useState<B[]>(() => {
    const src: InitialBlock[] =
      initial && initial.blocks.length > 0
        ? initial.blocks
        : [{ type: "text", content: "", caption: "", attachmentId: null }];
    return src.map((b): B =>
      b.type === "image" && b.attachmentId
        ? { key: nextKey.current++, type: "image", attachmentId: b.attachmentId, caption: b.caption }
        : { key: nextKey.current++, type: "text", content: b.content }
    );
  });
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(0);
  const [drag, setDrag] = useState(false);

  const upload = useCallback(async (file: File) => {
    setMsg("");
    setUploading((n) => n + 1);
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/attachments", { method: "POST", body: form });
    setUploading((n) => n - 1);
    if (res.status === 401) { window.location.href = "/"; return; }
    const data = await res.json().catch(() => ({}));
    if (data.ok) {
      setBlocks((b) => [...b, { key: nextKey.current++, type: "image", attachmentId: data.id, caption: "" }]);
    } else {
      setMsg(data.error ?? "Could not upload the picture");
    }
  }, []);

  // Paste a screenshot (Ctrl+V) anywhere on the page
  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const files: File[] = [];
      for (const item of Array.from(e.clipboardData?.items ?? [])) {
        if (item.kind === "file" && item.type.startsWith("image/")) {
          const f = item.getAsFile();
          if (f) files.push(f);
        }
      }
      if (files.length === 0) return; // normal text paste continues as usual
      e.preventDefault();
      files.forEach(upload);
    }
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [upload]);

  async function pasteFromClipboard() {
    setMsg("");
    try {
      const items = await navigator.clipboard.read();
      let found = false;
      for (const item of items) {
        const type = item.types.find((t) => t.startsWith("image/"));
        if (!type) continue;
        const blob = await item.getType(type);
        await upload(new File([blob], "pasted." + type.split("/")[1], { type }));
        found = true;
      }
      if (!found) setMsg("No picture on the clipboard. Take a screenshot first (Win+Shift+S).");
    } catch {
      setMsg("The browser blocked clipboard access. Click on the page and press Ctrl+V instead.");
    }
  }

  const addText = () =>
    setBlocks((b) => [...b, { key: nextKey.current++, type: "text", content: "" }]);
  const setContent = (key: number, content: string) =>
    setBlocks((b) => b.map((x) => (x.key === key && x.type === "text" ? { ...x, content } : x)));
  const setCaption = (key: number, caption: string) =>
    setBlocks((b) => b.map((x) => (x.key === key && x.type === "image" ? { ...x, caption } : x)));
  const remove = (key: number) => setBlocks((b) => b.filter((x) => x.key !== key));
  const move = (i: number, d: number) =>
    setBlocks((b) => {
      const j = i + d;
      if (j < 0 || j >= b.length) return b;
      const c = [...b];
      [c[i], c[j]] = [c[j], c[i]];
      return c;
    });

  async function save() {
    setMsg("");
    if (!title.trim()) { setMsg("Please add a title"); return; }
    setSaving(true);
    const err = await onSubmit({
      title,
      status,
      blocks: blocks.map((b) =>
        b.type === "text"
          ? { type: "text" as const, content: b.content }
          : { type: "image" as const, attachmentId: b.attachmentId, caption: b.caption }
      ),
    });
    if (err) { setMsg(err); setSaving(false); }
  }

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: 24 }}>
      <p style={{ margin: 0 }}><Link href={backHref}>&larr; {backLabel}</Link></p>
      <h1 style={{ marginBottom: 4 }}>{heading}</h1>

      <div style={card}>
        <label>
          <b>Title</b>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200}
            placeholder="Short name of the problem" style={field} />
        </label>

        {showStatus && (
          <label style={{ display: "block", marginTop: 12 }}>
            <b>Status</b>
            <select value={status} onChange={(e) => setStatus(e.target.value as Status)} style={field}>
              <option value="draft">Draft</option>
              <option value="verified">Verified (the fix works)</option>
              <option value="outdated">Outdated (no longer correct)</option>
            </select>
          </label>
        )}
      </div>

      <h3 style={{ marginBottom: 0 }}>How to fix it</h3>
        <p style={{ marginTop: 4, color: "#5b6670" }}>
        Paste a screenshot of the error (Ctrl+V), then add the steps. Mix text and pictures in any order.
      </p>

      {blocks.map((b, i) => (
        <div key={b.key} style={card}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <b style={{ flex: 1 }}>{b.type === "text" ? "Text" : "Picture"}</b>
            <button style={btn} onClick={() => move(i, -1)} disabled={i === 0}>&uarr;</button>
            <button style={btn} onClick={() => move(i, 1)} disabled={i === blocks.length - 1}>&darr;</button>
            <button style={{ ...btn, color: "#c0392b" }} onClick={() => remove(b.key)}>Remove</button>
          </div>

          {b.type === "text" ? (
            <textarea rows={3} value={b.content} onChange={(e) => setContent(b.key, e.target.value)}
              maxLength={5000} placeholder="Write an instruction or a note" style={field} />
          ) : (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/attachments/${b.attachmentId}?thumb=1`}
                alt="Uploaded screenshot"
                style={{ maxWidth: "100%", marginTop: 8, borderRadius: 10, border: "1px solid #d9d6cc" }}
              />
              <input value={b.caption} onChange={(e) => setCaption(b.key, e.target.value)} maxLength={200}
                placeholder="Caption (optional)" style={field} />
            </>
          )}
        </div>
      ))}

      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/")).forEach(upload);
        }}
        style={{
          border: "2px dashed " + (drag ? "#b5541a" : "#d9d6cc"),
          borderRadius: 14, padding: 24, textAlign: "center", color: "#5b6670", margin: "12px 0",
        }}
      >
        Press <b>Ctrl+V</b> to paste a screenshot, or drag a picture here
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button style={btn} onClick={addText}>+ Text</button>
        <button style={btn} onClick={() => fileRef.current?.click()}>+ Choose picture</button>
        <button style={btn} onClick={pasteFromClipboard}>Paste from clipboard</button>
        <input
          ref={fileRef} type="file" accept="image/*" multiple hidden
          onChange={(e) => { Array.from(e.target.files ?? []).forEach(upload); e.target.value = ""; }}
        />
      </div>
      {uploading > 0 && <p style={{ color: "#5b6670" }}>Uploading picture...</p>}

      {msg && <p style={{ color: "#c0392b" }}>{msg}</p>}
      <p>
        <button
          onClick={save}
          disabled={saving || uploading > 0}
          style={{ ...btn, background: "#b5541a", color: "#fff", border: "1px solid #b5541a", fontWeight: 700 }}
        >
          {saving ? "Saving..." : submitLabel}
        </button>
      </p>
    </main>
  );
}
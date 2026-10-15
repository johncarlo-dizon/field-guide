"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

type B =
  | { key: number; type: "text"; content: string }
  | { key: number; type: "image"; attachmentId: string; caption: string };

const card = {
  background: "#fff", border: "1px solid #d9d6cc", borderRadius: 14, padding: 16, margin: "12px 0",
} as const;
const field = {
  width: "100%", padding: 10, borderRadius: 10, border: "1px solid #d9d6cc",
  marginTop: 6, boxSizing: "border-box", font: "inherit",
} as const;
const btn = { padding: "8px 14px", borderRadius: 10, border: "1px solid #d9d6cc", background: "#fff", cursor: "pointer" } as const;

export default function NewError() {
  const router = useRouter();
  const nextKey = useRef(1);
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [errorText, setErrorText] = useState("");
  const [blocks, setBlocks] = useState<B[]>([{ key: 0, type: "text", content: "" }]);
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

  // The "Paste from clipboard" button
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
    const res = await fetch("/api/errors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        errorText,
        blocks: blocks.map((b) =>
          b.type === "text"
            ? { type: "text", content: b.content }
            : { type: "image", attachmentId: b.attachmentId, caption: b.caption }
        ),
      }),
    });
    if (res.status === 401) { window.location.href = "/"; return; }
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (data.ok) router.push(`/errors/${data.id}`);
    else setMsg(data.error ?? "Could not save");
  }

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: 24 }}>
      <p style={{ margin: 0 }}><Link href="/errors">&larr; Back to the list</Link></p>
      <h1 style={{ marginBottom: 4 }}>Add a new error</h1>

      <div style={card}>
        <label>
          <b>Title</b>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200}
            placeholder="Short name of the problem" style={field} />
        </label>
        <label style={{ display: "block", marginTop: 12 }}>
          <b>Error message as seen</b>
          <input value={errorText} onChange={(e) => setErrorText(e.target.value)} maxLength={500}
            placeholder="Type the exact message shown on the screen" style={field} />
        </label>
      </div>

      <h3 style={{ marginBottom: 0 }}>How to fix it</h3>
      <p style={{ marginTop: 4, color: "#5b6670" }}>
        Mix text and pictures in any order. Tip: take a screenshot, then press Ctrl+V on this page to add it.
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
          {saving ? "Saving..." : "Save error"}
        </button>
      </p>
    </main>
  );
}
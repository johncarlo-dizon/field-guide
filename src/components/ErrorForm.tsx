"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import AppShell from "@/components/AppShell";
import BlockItem from "@/components/BlockItem";
import TextEditor from "@/components/TextEditor";

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
type Pending = { key: number; attachmentId: string; caption: string };
type Composer = null | "text" | "image";

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

const ui = {
  card: { background: "#fff", border: "1px solid #e4e4e4", borderRadius: 16, padding: 16, margin: "12px 0" },
  field: {
    width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid #e4e4e4",
    background: "#fafafa", marginTop: 6, boxSizing: "border-box", font: "inherit",
  },
  btn: {
    padding: "10px 14px", borderRadius: 10, border: "1px solid #e4e4e4", background: "#fafafa",
    color: "#171717", cursor: "pointer", font: "inherit", fontWeight: 600,
  },
  dark: { background: "#262626", color: "#fff", border: "1px solid #262626" },
  small: { padding: "6px 10px", fontSize: 14, fontWeight: 500 },
  muted: { color: "#6b6b6b" },
} as const;

function ImageIcon() {
  return (
    <svg
      width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21" />
    </svg>
  );
}

export default function ErrorForm({
  heading, backHref, backLabel, submitLabel, showStatus, initial, onSubmit,
}: Props) {
  const nextKey = useRef(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState(initial?.title ?? "");
  const [status, setStatus] = useState<Status>(initial?.status ?? "draft");
  const [blocks, setBlocks] = useState<B[]>(() =>
    (initial?.blocks ?? []).flatMap((b): B[] => {
      if (b.type === "image") {
        return b.attachmentId
          ? [{ key: nextKey.current++, type: "image", attachmentId: b.attachmentId, caption: b.caption }]
          : [];
      }
      return [{ key: nextKey.current++, type: "text", content: b.content }];
    })
  );

  const [composer, setComposer] = useState<Composer>(null);
  const [draftText, setDraftText] = useState("");
  const [pending, setPending] = useState<Pending[]>([]);
  const [drag, setDrag] = useState(false);
  const [uploading, setUploading] = useState(0);
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);

  /* ---------- pictures ---------- */

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
      setPending((p) => [...p, { key: nextKey.current++, attachmentId: data.id, caption: "" }]);
      setComposer("image"); // a pasted picture opens the picture card automatically
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

  /* ---------- the card that opens under the buttons ---------- */

  const toggle = (kind: "text" | "image") => setComposer((c) => (c === kind ? null : kind));

  function cancelComposer() {
    setComposer(null);
    setDraftText("");
    setPending([]);
  }

  function addText() {
    if (!draftText.trim()) return;
    setBlocks((b) => [...b, { key: nextKey.current++, type: "text", content: draftText }]);
    setDraftText("");
    setComposer(null);
  }

  function addPictures() {
    if (pending.length === 0) return;
    setBlocks((b) => [
      ...b,
      ...pending.map((p): B => ({
        key: nextKey.current++, type: "image", attachmentId: p.attachmentId, caption: p.caption,
      })),
    ]);
    setPending([]);
    setComposer(null);
  }

  /* ---------- blocks already added ---------- */

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

  /* ---------- save the whole entry ---------- */

  async function save() {
    setMsg("");
    if (!title.trim()) { setMsg("Please add a title"); return; }

    // Anything still open in the card is included, so nothing typed is lost.
    const all: B[] = [...blocks];
    if (draftText.trim()) all.push({ key: -1, type: "text", content: draftText });
    pending.forEach((p) =>
      all.push({ key: -2, type: "image", attachmentId: p.attachmentId, caption: p.caption })
    );

    setSaving(true);
    const err = await onSubmit({
      title,
      status,
      blocks: all.map((b) =>
        b.type === "text"
          ? { type: "text" as const, content: b.content }
          : { type: "image" as const, attachmentId: b.attachmentId, caption: b.caption }
      ),
    });
    if (err) { setMsg(err); setSaving(false); }
  }

  /* ---------- screen ---------- */

  return (
    <AppShell>
      <main style={{ padding: "16px 0 32px" }}>
        <p style={{ margin: "0 0 4px" }}>
          <Link href={backHref} style={{ ...ui.muted, fontSize: 14 }}>&larr; {backLabel}</Link>
        </p>
        <h1 style={{ marginBottom: 4 }}>{heading}</h1>

        {/* Title and the two add buttons */}
        <div style={ui.card}>
          <label>
            <b>Title</b>
            <input
              value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200}
              placeholder="Short name of the problem" style={ui.field}
            />
          </label>

          {showStatus && (
            <label style={{ display: "block", marginTop: 12 }}>
              <b>Status</b>
              <select value={status} onChange={(e) => setStatus(e.target.value as Status)} style={ui.field}>
                <option value="draft">Draft</option>
                <option value="verified">Verified (the fix works)</option>
                <option value="outdated">Outdated (no longer correct)</option>
              </select>
            </label>
          )}

          <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
            <button
              type="button" onClick={() => toggle("text")}
              style={{ ...ui.btn, flex: 1, ...(composer === "text" ? ui.dark : {}) }}
            >
              Text
            </button>
            <button
              type="button" onClick={() => toggle("image")}
              aria-label="Add a picture" title="Add a picture"
              style={{
                ...ui.btn, flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
                ...(composer === "image" ? ui.dark : {}),
              }}
            >
              <ImageIcon />
            </button>
          </div>
        </div>

        {/* Text card */}
        {composer === "text" && (
          <div style={ui.card}>
            <TextEditor value={draftText} onChange={setDraftText} autoFocus />
            <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
              <button
                type="button" onClick={addText} disabled={!draftText.trim()}
                style={{ ...ui.btn, ...ui.dark, flex: 1, opacity: draftText.trim() ? 1 : 0.5 }}
              >
                Add
              </button>
              <button type="button" onClick={cancelComposer} style={{ ...ui.btn, flex: 1 }}>Cancel</button>
            </div>
          </div>
        )}

        {/* Picture card */}
        {composer === "image" && (
          <div style={ui.card}>
            <div
              onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDrag(false);
                Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/")).forEach(upload);
              }}
              style={{
                border: "2px dashed " + (drag ? "#262626" : "#d4d4d4"), borderRadius: 12,
                padding: 20, textAlign: "center", background: "#fafafa",
              }}
            >
              <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
                <button type="button" style={ui.btn} onClick={() => fileRef.current?.click()}>
                  Choose image
                </button>
                <button type="button" style={ui.btn} onClick={pasteFromClipboard}>
                  Paste from clipboard
                </button>
              </div>
              <input
                ref={fileRef} type="file" accept="image/*" multiple hidden
                onChange={(e) => { Array.from(e.target.files ?? []).forEach(upload); e.target.value = ""; }}
              />
            </div>

            {uploading > 0 && <p style={ui.muted}>Uploading picture...</p>}

            {pending.map((p) => (
              <div key={p.key} style={{ marginTop: 12 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/attachments/${p.attachmentId}?thumb=1`} alt="Uploaded screenshot"
                  style={{ maxWidth: "100%", borderRadius: 10, border: "1px solid #e4e4e4" }}
                />
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    value={p.caption} maxLength={200} placeholder="Caption (optional)"
                    onChange={(e) =>
                      setPending((list) => list.map((x) => (x.key === p.key ? { ...x, caption: e.target.value } : x)))
                    }
                    style={ui.field}
                  />
                  <button
                    type="button" style={{ ...ui.btn, ...ui.small, marginTop: 6 }}
                    onClick={() => setPending((list) => list.filter((x) => x.key !== p.key))}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}

            <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
              <button
                type="button" onClick={addPictures} disabled={pending.length === 0}
                style={{ ...ui.btn, ...ui.dark, flex: 1, opacity: pending.length ? 1 : 0.5 }}
              >
                Add
              </button>
              <button type="button" onClick={cancelComposer} style={{ ...ui.btn, flex: 1 }}>Cancel</button>
            </div>
          </div>
        )}

        {/* What has been added so far: each block is a row you can expand */}
        <div style={{ marginTop: 8 }}>
          {blocks.map((b, i) => (
            <BlockItem
              key={b.key}
              block={b}
              first={i === 0}
              last={i === blocks.length - 1}
              onMove={(d) => move(i, d)}
              onRemove={() => remove(b.key)}
              onText={(v) => setContent(b.key, v)}
              onCaption={(v) => setCaption(b.key, v)}
            />
          ))}
        </div>

        {msg && <p style={{ color: "#c0392b" }}>{msg}</p>}

        <button
          type="button" onClick={save} disabled={saving || uploading > 0}
          style={{ ...ui.btn, ...ui.dark, width: "100%", padding: "14px", marginTop: 8, opacity: saving ? 0.6 : 1 }}
        >
          {saving ? "Saving..." : submitLabel}
        </button>
      </main>
    </AppShell>
  );
}
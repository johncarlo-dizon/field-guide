"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { InitialBlock } from "@/components/ErrorForm";
import AppShell from "@/components/AppShell";
type B =
  | { key: number; type: "text"; content: string }
  | { key: number; type: "image"; attachmentId: string; caption: string };
type P = { key: number; title: string; blocks: B[] };
type Pending = { pkey: number; key: number; attachmentId: string; caption: string };
type Composer = null | { pkey: number; kind: "text" | "image" };

export type ProcInitial = {
  title: string;
  processes: { title: string; blocks: InitialBlock[] }[];
};
type PayloadBlock =
  | { type: "text"; content: string }
  | { type: "image"; attachmentId: string; caption: string };
export type ProcPayload = {
  title: string;
  processes: { title: string; blocks: PayloadBlock[] }[];
};

type Props = {
  heading: string;
  backHref: string;
  backLabel: string;
  submitLabel: string;
  initial?: ProcInitial;
  // Return an error message to show, or null when saved (the page then navigates away)
  onSubmit: (p: ProcPayload) => Promise<string | null>;
};

const ui = {
  card: { background: "#fff", border: "1px solid #e4e4e4", borderRadius: 16, padding: 16, margin: "12px 0" },
  inner: { background: "#fafafa", border: "1px solid #eee", borderRadius: 12, padding: 12, margin: "10px 0" },
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

const toPayload = (b: B): PayloadBlock =>
  b.type === "text"
    ? { type: "text", content: b.content }
    : { type: "image", attachmentId: b.attachmentId, caption: b.caption };

export default function ProcedureForm({
  heading, backHref, backLabel, submitLabel, initial, onSubmit,
}: Props) {
  const nextKey = useRef(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const targetRef = useRef<number | null>(null); // the process that receives a pasted picture

  const [title, setTitle] = useState(initial?.title ?? "");
  const [procs, setProcs] = useState<P[]>(() =>
    (initial?.processes ?? []).map((p) => ({
      key: nextKey.current++,
      title: p.title,
      blocks: p.blocks.flatMap((b): B[] => {
        if (b.type === "image") {
          return b.attachmentId
            ? [{ key: nextKey.current++, type: "image", attachmentId: b.attachmentId, caption: b.caption }]
            : [];
        }
        return [{ key: nextKey.current++, type: "text", content: b.content }];
      }),
    }))
  );
  const [composer, setComposer] = useState<Composer>(null);
  const [draftText, setDraftText] = useState("");
  const [pending, setPending] = useState<Pending[]>([]);
  const [drag, setDrag] = useState<number | null>(null);
  const [uploading, setUploading] = useState(0);
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);

  const procsRef = useRef(procs);
  const composerRef = useRef(composer);
  procsRef.current = procs;
  composerRef.current = composer;

  const updBlocks = useCallback(
    (pkey: number, fn: (b: B[]) => B[]) =>
      setProcs((l) => l.map((p) => (p.key === pkey ? { ...p, blocks: fn(p.blocks) } : p))),
    []
  );

  /* ---------- pictures ---------- */

  const upload = useCallback(
    async (file: File, target: number | null) => {
      setMsg("");
      if (target === null) {
        setMsg("Click inside a process first, then paste the picture.");
        return;
      }
      setUploading((n) => n + 1);
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/attachments", { method: "POST", body: form });
      setUploading((n) => n - 1);
      if (res.status === 401) { window.location.href = "/"; return; }
      const data = await res.json().catch(() => ({}));
      if (!data.ok) { setMsg(data.error ?? "Could not upload the picture"); return; }

      const c = composerRef.current;
      if (c && c.pkey === target && c.kind === "image") {
        setPending((p) => [...p, { pkey: target, key: nextKey.current++, attachmentId: data.id, caption: "" }]);
      } else {
        updBlocks(target, (b) => [
          ...b,
          { key: nextKey.current++, type: "image", attachmentId: data.id, caption: "" },
        ]);
      }
    },
    [updBlocks]
  );

  // Ctrl+V pastes a screenshot into the process you last clicked in
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
      const list = procsRef.current;
      const known = list.some((p) => p.key === targetRef.current);
      const target = known ? targetRef.current : list.length === 1 ? list[0].key : null;
      files.forEach((f) => upload(f, target));
    }
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [upload]);

  async function pasteFromClipboard(pkey: number) {
    setMsg("");
    try {
      const items = await navigator.clipboard.read();
      let found = false;
      for (const item of items) {
        const type = item.types.find((t) => t.startsWith("image/"));
        if (!type) continue;
        const blob = await item.getType(type);
        await upload(new File([blob], "pasted." + type.split("/")[1], { type }), pkey);
        found = true;
      }
      if (!found) setMsg("No picture on the clipboard. Take a screenshot first (Win+Shift+S).");
    } catch {
      setMsg("The browser blocked clipboard access. Click inside the process and press Ctrl+V instead.");
    }
  }

  /* ---------- processes ---------- */

  function addProcess() {
    const key = nextKey.current++;
    targetRef.current = key;
    setProcs((l) => [...l, { key, title: "", blocks: [] }]);
  }
  const setProcTitle = (key: number, t: string) =>
    setProcs((l) => l.map((p) => (p.key === key ? { ...p, title: t } : p)));
  function removeProc(key: number) {
    if (!confirm("Remove this process and everything in it?")) return;
    if (composer?.pkey === key) closeComposer();
    setProcs((l) => l.filter((p) => p.key !== key));
  }
  const moveProc = (i: number, d: number) =>
    setProcs((l) => {
      const j = i + d;
      if (j < 0 || j >= l.length) return l;
      const c = [...l];
      [c[i], c[j]] = [c[j], c[i]];
      return c;
    });

  /* ---------- the card that opens under a process's buttons ---------- */

  function closeComposer() {
    const c = composer;
    setComposer(null);
    setDraftText("");
    if (c) setPending((p) => p.filter((x) => x.pkey !== c.pkey));
  }

  function toggle(pkey: number, kind: "text" | "image") {
    targetRef.current = pkey;
    if (composer && composer.pkey === pkey && composer.kind === kind) {
      closeComposer();
      return;
    }
    if (composer && composer.pkey !== pkey) {
      setDraftText("");
      setPending((p) => p.filter((x) => x.pkey !== composer.pkey));
    }
    setComposer({ pkey, kind });
  }

  function addText() {
    if (!composer || !draftText.trim()) return;
    const text = draftText;
    updBlocks(composer.pkey, (b) => [...b, { key: nextKey.current++, type: "text", content: text }]);
    setDraftText("");
    setComposer(null);
  }

  function addPictures() {
    if (!composer) return;
    const pkey = composer.pkey;
    const mine = pending.filter((x) => x.pkey === pkey);
    if (mine.length === 0) return;
    updBlocks(pkey, (b) => [
      ...b,
      ...mine.map((x): B => ({
        key: nextKey.current++, type: "image", attachmentId: x.attachmentId, caption: x.caption,
      })),
    ]);
    setPending((p) => p.filter((x) => x.pkey !== pkey));
    setComposer(null);
  }

  /* ---------- blocks already added to a process ---------- */

  const setContent = (pkey: number, key: number, content: string) =>
    updBlocks(pkey, (b) => b.map((x) => (x.key === key && x.type === "text" ? { ...x, content } : x)));
  const setCaption = (pkey: number, key: number, caption: string) =>
    updBlocks(pkey, (b) => b.map((x) => (x.key === key && x.type === "image" ? { ...x, caption } : x)));
  const removeBlock = (pkey: number, key: number) => updBlocks(pkey, (b) => b.filter((x) => x.key !== key));
  const moveBlock = (pkey: number, i: number, d: number) =>
    updBlocks(pkey, (b) => {
      const j = i + d;
      if (j < 0 || j >= b.length) return b;
      const c = [...b];
      [c[i], c[j]] = [c[j], c[i]];
      return c;
    });

  /* ---------- save everything ---------- */

  async function save() {
    setMsg("");
    if (!title.trim()) { setMsg("Please add a title"); return; }

    const out: ProcPayload["processes"] = [];
    for (const p of procs) {
      if (!p.title.trim()) { setMsg("Every process needs a title"); return; }
      const blocks: PayloadBlock[] = p.blocks.map(toPayload);
      // Anything still open in a card is included, so nothing typed is lost.
      if (composer?.pkey === p.key) {
        if (draftText.trim()) blocks.push({ type: "text", content: draftText });
        pending
          .filter((x) => x.pkey === p.key)
          .forEach((x) => blocks.push({ type: "image", attachmentId: x.attachmentId, caption: x.caption }));
      }
      out.push({ title: p.title, blocks });
    }

    setSaving(true);
    const err = await onSubmit({ title, processes: out });
    if (err) { setMsg(err); setSaving(false); }
  }

  /* ---------- screen ---------- */

  return (
    <AppShell>
      <main style={{ padding: "16px 0 32px" }}>
        <p style={{ margin: "0 0 4px" }}><Link href={backHref} style={{ ...ui.muted, fontSize: 14 }}>&larr; {backLabel}</Link></p>
        <h1 style={{ marginBottom: 4 }}>{heading}</h1>

        <div style={ui.card}>
          <label>
            <b>Title</b>
            <input
              value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200}
              placeholder="For example: Grand Opening" style={ui.field}
            />
          </label>
        </div>

        {procs.map((p, i) => {
          const open = composer && composer.pkey === p.key ? composer : null;
          const mine = pending.filter((x) => x.pkey === p.key);

          return (
            <div
              key={p.key} style={ui.card}
              onClickCapture={() => { targetRef.current = p.key; }}
              onFocusCapture={() => { targetRef.current = p.key; }}
            >
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <b style={{ ...ui.muted, width: 24 }}>{i + 1}.</b>
                <input
                  value={p.title} onChange={(e) => setProcTitle(p.key, e.target.value)} maxLength={200}
                  placeholder="Process name, for example: POS configuration"
                  style={{ ...ui.field, marginTop: 0, flex: 1 }}
                />
                <button type="button" style={{ ...ui.btn, ...ui.small }} onClick={() => moveProc(i, -1)} disabled={i === 0}>&uarr;</button>
                <button type="button" style={{ ...ui.btn, ...ui.small }} onClick={() => moveProc(i, 1)} disabled={i === procs.length - 1}>&darr;</button>
                <button type="button" style={{ ...ui.btn, ...ui.small, color: "#c0392b" }} onClick={() => removeProc(p.key)}>Remove</button>
              </div>

              {p.blocks.map((b, bi) => (
                <div key={b.key} style={ui.inner}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <b style={{ flex: 1, fontSize: 14 }}>{b.type === "text" ? "Text" : "Picture"}</b>
                    <button type="button" style={{ ...ui.btn, ...ui.small }} onClick={() => moveBlock(p.key, bi, -1)} disabled={bi === 0}>&uarr;</button>
                    <button type="button" style={{ ...ui.btn, ...ui.small }} onClick={() => moveBlock(p.key, bi, 1)} disabled={bi === p.blocks.length - 1}>&darr;</button>
                    <button type="button" style={{ ...ui.btn, ...ui.small, color: "#c0392b" }} onClick={() => removeBlock(p.key, b.key)}>Remove</button>
                  </div>

                  {b.type === "text" ? (
                    <textarea
                      rows={3} value={b.content} onChange={(e) => setContent(p.key, b.key, e.target.value)}
                      maxLength={5000} style={{ ...ui.field, background: "#fff" }}
                    />
                  ) : (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`/api/attachments/${b.attachmentId}?thumb=1`} alt="Uploaded screenshot"
                        style={{ maxWidth: "100%", marginTop: 8, borderRadius: 10, border: "1px solid #e4e4e4" }}
                      />
                      <input
                        value={b.caption} onChange={(e) => setCaption(p.key, b.key, e.target.value)}
                        maxLength={200} placeholder="Caption (optional)" style={{ ...ui.field, background: "#fff" }}
                      />
                    </>
                  )}
                </div>
              ))}

              <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
                <button
                  type="button" onClick={() => toggle(p.key, "text")}
                  style={{ ...ui.btn, flex: 1, ...(open?.kind === "text" ? ui.dark : {}) }}
                >
                  Text
                </button>
                <button
                  type="button" onClick={() => toggle(p.key, "image")}
                  aria-label="Add a picture" title="Add a picture"
                  style={{
                    ...ui.btn, flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
                    ...(open?.kind === "image" ? ui.dark : {}),
                  }}
                >
                  <ImageIcon />
                </button>
              </div>

              {open?.kind === "text" && (
                <div style={ui.inner}>
                  <textarea
                    autoFocus rows={4} value={draftText} onChange={(e) => setDraftText(e.target.value)}
                    maxLength={5000} placeholder="Write an instruction or a note"
                    style={{ ...ui.field, marginTop: 0, background: "#fff" }}
                  />
                  <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
                    <button
                      type="button" onClick={addText} disabled={!draftText.trim()}
                      style={{ ...ui.btn, ...ui.dark, flex: 1, opacity: draftText.trim() ? 1 : 0.5 }}
                    >
                      Add
                    </button>
                    <button type="button" onClick={closeComposer} style={{ ...ui.btn, flex: 1 }}>Cancel</button>
                  </div>
                </div>
              )}

              {open?.kind === "image" && (
                <div style={ui.inner}>
                  <div
                    onDragOver={(e) => { e.preventDefault(); setDrag(p.key); }}
                    onDragLeave={() => setDrag(null)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDrag(null);
                      Array.from(e.dataTransfer.files)
                        .filter((f) => f.type.startsWith("image/"))
                        .forEach((f) => upload(f, p.key));
                    }}
                    style={{
                      border: "2px dashed " + (drag === p.key ? "#262626" : "#d4d4d4"), borderRadius: 12,
                      padding: 20, textAlign: "center", background: "#fff",
                    }}
                  >
                    <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
                      <button type="button" style={ui.btn} onClick={() => fileRef.current?.click()}>Choose image</button>
                      <button type="button" style={ui.btn} onClick={() => pasteFromClipboard(p.key)}>Paste from clipboard</button>
                    </div>
                  </div>

                  {uploading > 0 && <p style={ui.muted}>Uploading picture...</p>}

                  {mine.map((x) => (
                    <div key={x.key} style={{ marginTop: 12 }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`/api/attachments/${x.attachmentId}?thumb=1`} alt="Uploaded screenshot"
                        style={{ maxWidth: "100%", borderRadius: 10, border: "1px solid #e4e4e4" }}
                      />
                      <div style={{ display: "flex", gap: 8 }}>
                        <input
                          value={x.caption} maxLength={200} placeholder="Caption (optional)"
                          onChange={(e) =>
                            setPending((list) => list.map((y) => (y.key === x.key ? { ...y, caption: e.target.value } : y)))
                          }
                          style={{ ...ui.field, background: "#fff" }}
                        />
                        <button
                          type="button" style={{ ...ui.btn, ...ui.small, marginTop: 6 }}
                          onClick={() => setPending((list) => list.filter((y) => y.key !== x.key))}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}

                  <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
                    <button
                      type="button" onClick={addPictures} disabled={mine.length === 0}
                      style={{ ...ui.btn, ...ui.dark, flex: 1, opacity: mine.length ? 1 : 0.5 }}
                    >
                      Add
                    </button>
                    <button type="button" onClick={closeComposer} style={{ ...ui.btn, flex: 1 }}>Cancel</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        <input
          ref={fileRef} type="file" accept="image/*" multiple hidden
          onChange={(e) => {
            const target = composerRef.current?.pkey ?? null;
            Array.from(e.target.files ?? []).forEach((f) => upload(f, target));
            e.target.value = "";
          }}
        />

        <button type="button" onClick={addProcess} style={{ ...ui.btn, width: "100%" }}>+ Add process</button>

        {msg && <p style={{ color: "#c0392b" }}>{msg}</p>}

        <button
          type="button" onClick={save} disabled={saving || uploading > 0}
          style={{ ...ui.btn, ...ui.dark, width: "100%", padding: "14px", marginTop: 16, opacity: saving ? 0.6 : 1 }}
        >
          {saving ? "Saving..." : submitLabel}
        </button>
      </main>
    </AppShell>
  );
}
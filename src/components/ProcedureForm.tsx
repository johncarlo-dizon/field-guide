"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import AppShell from "@/components/AppShell";
import BlockItem, { type BlockData } from "@/components/BlockItem";
import TextEditor from "@/components/TextEditor";
import type { InitialBlock } from "@/components/ErrorForm";

type B = BlockData;
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
  openIndex?: number | null; // which process to open (and scroll to) first
  // Return an error message to show, or null when saved (the page then navigates away)
  onSubmit: (p: ProcPayload) => Promise<string | null>;
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

const toPayload = (b: B): PayloadBlock =>
  b.type === "text"
    ? { type: "text", content: b.content }
    : { type: "image", attachmentId: b.attachmentId, caption: b.caption };

export default function ProcedureForm({
  heading, backHref, backLabel, submitLabel, initial, openIndex, onSubmit,
}: Props) {
  const nextKey = useRef(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const targetRef = useRef<number | null>(null); // the process that receives a pasted picture
  const procRefs = useRef<Record<number, HTMLDivElement | null>>({});

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
  const [openProcs, setOpenProcs] = useState<Record<number, boolean>>({}); // expanded processes

  const [composer, setComposer] = useState<Composer>(null);
  const [draftText, setDraftText] = useState("");
  const [pending, setPending] = useState<Pending[]>([]);
  const [drag, setDrag] = useState<number | null>(null);
  const [uploading, setUploading] = useState(0);
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);

  const procsRef = useRef(procs);
  const composerRef = useRef(composer);
  const openRef = useRef(openProcs);
  procsRef.current = procs;
  composerRef.current = composer;
  openRef.current = openProcs;

  const updBlocks = useCallback(
    (pkey: number, fn: (b: B[]) => B[]) =>
      setProcs((l) => l.map((p) => (p.key === pkey ? { ...p, blocks: fn(p.blocks) } : p))),
    []
  );

  // Open the process the person came from, and scroll to it.
  useEffect(() => {
    if (openIndex == null) return;
    const p = procsRef.current[openIndex];
    if (!p) return;
    setOpenProcs({ [p.key]: true });
    targetRef.current = p.key;
    requestAnimationFrame(() => {
      procRefs.current[p.key]?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- pictures ---------- */

  const upload = useCallback(
    async (file: File, target: number | null) => {
      setMsg("");
      if (target === null) {
        setMsg("Open a process and click inside it first, then paste the picture.");
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

  // Ctrl+V pastes a screenshot into the open process you last clicked in
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
      const t = targetRef.current;
      let target: number | null = null;
      if (t !== null && list.some((p) => p.key === t) && openRef.current[t]) target = t;
      else if (list.length === 1 && openRef.current[list[0].key]) target = list[0].key;
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
    setOpenProcs((o) => ({ ...o, [key]: true }));
    requestAnimationFrame(() => {
      procRefs.current[key]?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
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
  function toggleProc(key: number) {
    if (openProcs[key] && composer?.pkey === key) closeComposer();
    setOpenProcs((o) => ({ ...o, [key]: !o[key] }));
  }

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
      if (!p.title.trim()) {
        setOpenProcs((o) => ({ ...o, [p.key]: true }));
        setMsg("Every process needs a name");
        return;
      }
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
        <p style={{ margin: "0 0 4px" }}>
          <Link href={backHref} style={{ ...ui.muted, fontSize: 14 }}>&larr; {backLabel}</Link>
        </p>
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
          const isOpen = !!openProcs[p.key];
          const open = composer && composer.pkey === p.key ? composer : null;
          const mine = pending.filter((x) => x.pkey === p.key);

          return (
            <div
              key={p.key}
              ref={(el) => { procRefs.current[p.key] = el; }}
              style={{ ...ui.card, padding: 0, overflow: "hidden", scrollMarginTop: 16 }}
              onClickCapture={() => { targetRef.current = p.key; }}
              onFocusCapture={() => { targetRef.current = p.key; }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 10px 10px 6px" }}>
                <button
                  type="button"
                  onClick={() => toggleProc(p.key)}
                  aria-expanded={isOpen}
                  style={{
                    flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 10, padding: 8,
                    border: 0, background: "transparent", cursor: "pointer", font: "inherit", color: "#171717", textAlign: "left",
                  }}
                >
                  <svg
                    width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6b6b6b" strokeWidth="2"
                    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
                    style={{ flex: "none", transform: isOpen ? "rotate(90deg)" : "none", transition: "transform 0.15s" }}
                  >
                    <path d="m9 6 6 6-6 6" />
                  </svg>
                  <span
                    style={{
                      width: 26, height: 26, borderRadius: "50%", background: "#262626", color: "#fff", flex: "none",
                      display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700,
                    }}
                  >
                    {i + 1}
                  </span>
                  <b style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {p.title.trim() || "Untitled process"}
                  </b>
                  <span style={{ flex: "none", fontSize: 13, ...ui.muted }}>
                    {p.blocks.length} {p.blocks.length === 1 ? "item" : "items"}
                  </span>
                </button>
                <button type="button" style={{ ...ui.btn, ...ui.small }} onClick={() => moveProc(i, -1)} disabled={i === 0} aria-label="Move up">&uarr;</button>
                <button type="button" style={{ ...ui.btn, ...ui.small }} onClick={() => moveProc(i, 1)} disabled={i === procs.length - 1} aria-label="Move down">&darr;</button>
                <button type="button" style={{ ...ui.btn, ...ui.small, color: "#c0392b" }} onClick={() => removeProc(p.key)}>Remove</button>
              </div>

              {isOpen && (
                <div style={{ padding: "0 16px 16px", borderTop: "1px solid #eee" }}>
                  <label style={{ display: "block", marginTop: 14 }}>
                    <b style={{ fontSize: 14 }}>Process name</b>
                    <input
                      value={p.title} onChange={(e) => setProcTitle(p.key, e.target.value)} maxLength={200}
                      autoFocus={!p.title} placeholder="For example: POS configuration" style={ui.field}
                    />
                  </label>

                  <div style={{ marginTop: 6 }}>
                    {p.blocks.map((b, bi) => (
                      <BlockItem
                        key={b.key}
                        block={b}
                        first={bi === 0}
                        last={bi === p.blocks.length - 1}
                        onMove={(d) => moveBlock(p.key, bi, d)}
                        onRemove={() => removeBlock(p.key, b.key)}
                        onText={(v) => setContent(p.key, b.key, v)}
                        onCaption={(v) => setCaption(p.key, b.key, v)}
                      />
                    ))}
                  </div>

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
                    <div style={{ background: "#fafafa", border: "1px solid #eee", borderRadius: 12, padding: 12, margin: "10px 0" }}>
                      <TextEditor value={draftText} onChange={setDraftText} autoFocus />
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
                    <div style={{ background: "#fafafa", border: "1px solid #eee", borderRadius: 12, padding: 12, margin: "10px 0" }}>
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
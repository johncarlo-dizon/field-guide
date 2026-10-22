"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { color, ui } from "@/lib/ui";
import RichText from "@/components/RichText";
type Block = {
  id: string;
  type: "text" | "image";
  content: string;
  caption: string;
  attachmentId: string | null;
};
type Process = { id: string; title: string; blocks: Block[] };
type Detail = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  authorName: string;
  authorPosition: string;
  processes: Process[];
  canEdit: boolean;
  canDelete: boolean;
};

export default function ProcedureDetail() {
  const params = useParams();
  const router = useRouter();
  const id = String(params.id);
  const [p, setP] = useState<Detail | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/procedures/${id}`);
      if (res.status === 401) { window.location.href = "/"; return; }
      const data = await res.json().catch(() => ({}));
      if (!data.ok) { setMsg(data.error ?? "Could not load this procedure"); return; }
      setP(data.procedure);
      const first = data.procedure.processes[0];
      if (first) setOpen({ [first.id]: true });
    })();
  }, [id]);

  const allOpen = !!p && p.processes.length > 0 && p.processes.every((x) => open[x.id]);
  const toggleAll = () => {
    if (!p) return;
    setOpen(Object.fromEntries(p.processes.map((x) => [x.id, !allOpen])));
  };

  async function remove() {
    if (!confirm("Delete this procedure? An admin can restore it later.")) return;
    const res = await fetch(`/api/procedures/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (data.ok) router.push("/procedures");
    else setMsg(data.error ?? "Could not delete");
  }

  return (
    <AppShell>
      <p style={{ margin: "16px 0 0" }}>
        <Link href="/procedures" style={{ ...ui.muted, fontSize: 14 }}>&larr; All procedures</Link>
      </p>

      {msg && <p style={{ color: color.danger }}>{msg}</p>}
      {!p && !msg && <p style={ui.muted}>Loading...</p>}

      {p && (
        <>
          <h1 style={{ margin: "8px 0 8px", fontSize: 26, lineHeight: 1.25 }}>{p.title}</h1>
          <div style={{ fontSize: 14, ...ui.muted }}>
            Added by <b style={{ color: color.ink }}>{p.authorName}</b> ({p.authorPosition}) · updated{" "}
            {new Date(p.updatedAt).toLocaleDateString()}
          </div>

          {p.processes.length > 0 && (
            <p style={{ margin: "16px 0 0" }}>
              <button onClick={toggleAll} style={{ ...ui.btn, ...ui.small }}>
                {allOpen ? "Collapse all" : "Expand all"}
              </button>
            </p>
          )}
          {p.processes.length === 0 && <p style={ui.muted}>This procedure has no processes yet.</p>}

          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 14 }}>
            {p.processes.map((proc, i) => {
              const isOpen = !!open[proc.id];
              return (
                <div key={proc.id} style={{ ...ui.card, padding: 0, overflow: "hidden" }}>
                  <button
                    onClick={() => setOpen((o) => ({ ...o, [proc.id]: !o[proc.id] }))}
                    aria-expanded={isOpen}
                    style={{
                      width: "100%", textAlign: "left", padding: 16, border: 0, background: "transparent",
                      cursor: "pointer", font: "inherit", color: color.ink, display: "flex", gap: 12, alignItems: "center",
                    }}
                  >
                    <span
                      style={{
                        width: 28, height: 28, borderRadius: "50%", background: color.dark, color: "#ffffff",
                        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, flex: "none",
                      }}
                    >
                      {i + 1}
                    </span>
                    <b style={{ flex: 1, fontSize: 17 }}>{proc.title}</b>
                    <svg
                      width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color.mut} strokeWidth="2"
                      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
                      style={{ transform: isOpen ? "rotate(90deg)" : "none", transition: "transform 0.15s" }}
                    >
                      <path d="m9 6 6 6-6 6" />
                    </svg>
                  </button>

                  {isOpen && (
                                        <div style={{ padding: "4px 16px 16px", borderTop: `1px solid ${color.line}` }}>
                      {p.canEdit && (
                        <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: 10 }}>
                          <Link
                            href={`/procedures/${id}/edit?process=${proc.id}`}
                            style={{ ...ui.btn, ...ui.small }}
                          >
                            Edit this process
                          </Link>
                        </div>
                      )}
                      {proc.blocks.length === 0 && (
                        <p style={ui.muted}>Nothing added to this process yet.</p>
                      )}
                      {proc.blocks.map((b) =>
                        b.type === "text" ? (
                          <div key={b.id} style={{ marginTop: 12 }}><RichText text={b.content} /></div>
                                                ) : (
                          <figure key={b.id} style={{ margin: "12px 0 0" }}>
                            <a href={`/api/attachments/${b.attachmentId}`} target="_blank" rel="noreferrer">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={`/api/attachments/${b.attachmentId}`}
                                alt={b.caption || "Screenshot"}
                                style={{ maxWidth: "100%", borderRadius: 10, border: `1px solid ${color.line}`, display: "block" }}
                              />
                            </a>
                            {b.caption && (
                              <figcaption style={{ marginTop: 6, fontSize: 14, ...ui.muted }}>{b.caption}</figcaption>
                            )}
                          </figure>
                        )
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div style={{ display: "flex", gap: 8, margin: "16px 0 8px", alignItems: "center" }}>
            {p.canEdit && (
              <Link
                href={`/procedures/${id}/edit`}
                style={{ ...ui.btn, ...ui.dark, display: "inline-flex", alignItems: "center", minHeight: 44 }}
              >
                Edit
              </Link>
            )}
            {p.canDelete && (
              <button
                onClick={remove}
                style={{ ...ui.btn, minHeight: 44, color: color.danger, borderColor: color.danger, background: color.card }}
              >
                Delete
              </button>
            )}
          </div>
          {!p.canEdit && <p style={ui.muted}>Only {p.authorName} can edit this procedure.</p>}
          <div style={{ height: 32 }} />
        </>
      )}
    </AppShell>
  );
}
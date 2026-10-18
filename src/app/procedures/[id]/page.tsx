"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

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

const card = {
  background: "#fff", border: "1px solid #e4e4e4", borderRadius: 16, margin: "12px 0", overflow: "hidden",
} as const;
const btn = {
  padding: "8px 14px", borderRadius: 10, border: "1px solid #e4e4e4", background: "#fafafa",
  cursor: "pointer", font: "inherit", fontWeight: 600,
} as const;

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
    <div style={{ background: "#f5f5f5", minHeight: "100vh" }}>
      <main style={{ maxWidth: 720, margin: "0 auto", padding: 24 }}>
        <p style={{ margin: 0 }}><Link href="/procedures">&larr; All procedures</Link></p>

        {msg && <p style={{ color: "#c0392b" }}>{msg}</p>}
        {!p && !msg && <p>Loading...</p>}

        {p && (
          <>
            <h1 style={{ marginBottom: 4 }}>{p.title}</h1>
            <div style={{ color: "#6b6b6b" }}>
              Added by <b>{p.authorName}</b> ({p.authorPosition}) &middot; updated{" "}
              {new Date(p.updatedAt).toLocaleDateString()}
            </div>

            {p.processes.length > 0 && (
              <p style={{ margin: "16px 0 0" }}>
                <button style={btn} onClick={toggleAll}>{allOpen ? "Collapse all" : "Expand all"}</button>
              </p>
            )}
            {p.processes.length === 0 && <p>This procedure has no processes yet.</p>}

            {p.processes.map((proc, i) => {
              const isOpen = !!open[proc.id];
              return (
                <div key={proc.id} style={card}>
                  <button
                    onClick={() => setOpen((o) => ({ ...o, [proc.id]: !o[proc.id] }))}
                    style={{
                      width: "100%", textAlign: "left", padding: 16, border: "none", background: "#fff",
                      cursor: "pointer", font: "inherit", display: "flex", gap: 12, alignItems: "center",
                    }}
                  >
                    <span style={{ color: "#6b6b6b", width: 24 }}>{i + 1}.</span>
                    <b style={{ flex: 1, fontSize: 17 }}>{proc.title}</b>
                    <span style={{ color: "#6b6b6b" }}>{isOpen ? "▾" : "▸"}</span>
                  </button>

                  {isOpen && (
                    <div style={{ padding: "0 16px 16px", borderTop: "1px solid #eee" }}>
                      {proc.blocks.length === 0 && <p style={{ color: "#6b6b6b" }}>Nothing added to this process yet.</p>}
                      {proc.blocks.map((b) =>
                        b.type === "text" ? (
                          <p key={b.id} style={{ whiteSpace: "pre-wrap" }}>{b.content}</p>
                        ) : (
                          <figure key={b.id} style={{ margin: "12px 0" }}>
                            <a href={`/api/attachments/${b.attachmentId}`} target="_blank" rel="noreferrer">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={`/api/attachments/${b.attachmentId}`}
                                alt={b.caption || "Screenshot"}
                                style={{ maxWidth: "100%", borderRadius: 10, border: "1px solid #e4e4e4" }}
                              />
                            </a>
                            {b.caption && <figcaption style={{ color: "#6b6b6b", marginTop: 4 }}>{b.caption}</figcaption>}
                          </figure>
                        )
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            <div style={{ display: "flex", gap: 8, marginTop: 16, alignItems: "center" }}>
              {p.canEdit && (
                <Link
                  href={`/procedures/${id}/edit`}
                  style={{ padding: "8px 14px", borderRadius: 10, background: "#262626", color: "#fff", textDecoration: "none", fontWeight: 600 }}
                >
                  Edit
                </Link>
              )}
              {p.canDelete && (
                <button style={{ ...btn, color: "#c0392b", borderColor: "#c0392b", background: "#fff" }} onClick={remove}>
                  Delete
                </button>
              )}
            </div>
            {!p.canEdit && (
              <p style={{ color: "#6b6b6b" }}>Only {p.authorName} can edit this procedure.</p>
            )}
          </>
        )}
      </main>
    </div>
  );
}
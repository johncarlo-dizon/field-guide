"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import AppShell from "@/components/AppShell";
import RichText from "@/components/RichText";
import { badge, color, ui } from "@/lib/ui";

type Block = {
  id: string;
  type: "text" | "image";
  content: string;
  caption: string;
  attachmentId: string | null;
};
type Part = { id: string; title: string; blocks: Block[] };
type Detail = {
  id: string;
  name: string;
  category: string;
  modelNumber: string;
  summary: string;
  updatedAt: string;
  authorName: string;
  authorPosition: string;
  parts: Part[];
  canEdit: boolean;
  canDelete: boolean;
};

// Text blocks one by one, and pictures that follow each other together in a grid (different angles).
function renderBlocks(blocks: Block[]): ReactNode[] {
  const out: ReactNode[] = [];
  let i = 0;
  while (i < blocks.length) {
    const b = blocks[i];
    if (b.type === "text") {
      out.push(<div key={b.id} style={{ marginTop: 12 }}><RichText text={b.content} /></div>);
      i++;
      continue;
    }
    const group: Block[] = [];
    while (i < blocks.length && blocks[i].type === "image") { group.push(blocks[i]); i++; }
    const small = group.length > 1;
    out.push(
      <div
        key={group[0].id}
        style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10, marginTop: 12 }}
      >
        {group.map((g) => (
          <figure key={g.id} style={{ margin: 0 }}>
            <a href={`/api/attachments/${g.attachmentId}`} target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/attachments/${g.attachmentId}${small ? "?thumb=1" : ""}`}
                alt={g.caption || "Photo"}
                style={{ width: "100%", borderRadius: 10, border: `1px solid ${color.line}`, display: "block" }}
              />
            </a>
            {g.caption && <figcaption style={{ marginTop: 6, fontSize: 14, ...ui.muted }}>{g.caption}</figcaption>}
          </figure>
        ))}
      </div>
    );
  }
  return out;
}

export default function EquipmentDetail() {
  const params = useParams();
  const router = useRouter();
  const id = String(params.id);
  const [e, setE] = useState<Detail | null>(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/equipment/${id}`);
      if (res.status === 401) { window.location.href = "/"; return; }
      const data = await res.json().catch(() => ({}));
      if (data.ok) setE(data.equipment);
      else setMsg(data.error ?? "Could not load this equipment");
    })();
  }, [id]);

  async function remove() {
    if (!confirm("Delete this equipment? An admin can restore it later.")) return;
    const res = await fetch(`/api/equipment/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (data.ok) router.push("/equipment");
    else setMsg(data.error ?? "Could not delete");
  }

  return (
    <AppShell>
      <p style={{ margin: "16px 0 0" }}>
        <Link href="/equipment" style={{ ...ui.muted, fontSize: 14 }}>&larr; All equipment</Link>
      </p>

      {msg && <p style={{ color: color.danger }}>{msg}</p>}
      {!e && !msg && <p style={ui.muted}>Loading...</p>}

      {e && (
        <>
          <h1 style={{ margin: "8px 0 8px", fontSize: 26, lineHeight: 1.25 }}>{e.name}</h1>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", fontSize: 14, ...ui.muted }}>
            {e.category && <span style={badge(color.dark)}>{e.category}</span>}
            {e.modelNumber && <span>Model {e.modelNumber}</span>}
          </div>

          {e.summary && (
            <div style={{ ...ui.card, marginTop: 14 }}>
              <b>What it is for</b>
              <p style={{ margin: "6px 0 0", lineHeight: 1.55, overflowWrap: "anywhere" }}>{e.summary}</p>
            </div>
          )}

          {e.parts.length === 0 && <p style={ui.muted}>No parts or photos added yet.</p>}

          {e.parts.map((p, i) => (
            <div key={p.id} style={{ ...ui.card, marginTop: 12 }}>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <span
                  style={{
                    width: 28, height: 28, borderRadius: "50%", background: color.dark, color: "#fff", flex: "none",
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700,
                  }}
                >
                  {i + 1}
                </span>
                <b style={{ fontSize: 18, overflowWrap: "anywhere" }}>{p.title}</b>
              </div>
              {renderBlocks(p.blocks)}
            </div>
          ))}

          <div style={{ fontSize: 13, margin: "14px 0 0", ...ui.muted }}>
            Added by <b style={{ color: color.ink }}>{e.authorName}</b> ({e.authorPosition}) · updated{" "}
            {new Date(e.updatedAt).toLocaleDateString()}
          </div>

          <div style={{ display: "flex", gap: 8, margin: "16px 0 8px", alignItems: "center" }}>
            {e.canEdit && (
              <Link
                href={`/equipment/${id}/edit`}
                style={{ ...ui.btn, ...ui.dark, display: "inline-flex", alignItems: "center", minHeight: 44 }}
              >
                Edit
              </Link>
            )}
            {e.canDelete && (
              <button
                onClick={remove}
                style={{ ...ui.btn, minHeight: 44, color: color.danger, borderColor: color.danger, background: color.card }}
              >
                Delete
              </button>
            )}
          </div>
          {!e.canEdit && <p style={ui.muted}>Only {e.authorName} can edit this equipment.</p>}
          <div style={{ height: 32 }} />
        </>
      )}
    </AppShell>
  );
}
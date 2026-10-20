"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { badge, color, statusColor, ui } from "@/lib/ui";

type Block = {
  id: string;
  position: number;
  type: "text" | "image";
  content: string;
  caption: string;
  attachmentId: string | null;
};
type Detail = {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  authorName: string;
  authorPosition: string;
  blocks: Block[];
  canEdit: boolean;
  canDelete: boolean;
};

export default function ErrorDetail() {
  const params = useParams();
  const router = useRouter();
  const id = String(params.id);
  const [e, setE] = useState<Detail | null>(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/errors/${id}`);
      if (res.status === 401) { window.location.href = "/"; return; }
      const data = await res.json().catch(() => ({}));
      if (data.ok) setE(data.error);
      else setMsg(data.error ?? "Could not load this error");
    })();
  }, [id]);

  async function remove() {
    if (!confirm("Delete this error? An admin can restore it later.")) return;
    const res = await fetch(`/api/errors/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (data.ok) router.push("/errors");
    else setMsg(data.error ?? "Could not delete");
  }

  return (
    <AppShell>
      <p style={{ margin: "16px 0 0" }}>
        <Link href="/errors" style={{ ...ui.muted, textDecoration: "none", fontSize: 14 }}>&larr; Back to the list</Link>
      </p>

      {msg && <p style={{ color: color.danger }}>{msg}</p>}
      {!e && !msg && <p style={ui.muted}>Loading...</p>}

      {e && (
        <>
          <h1 style={{ margin: "8px 0 8px", fontSize: 26, lineHeight: 1.25 }}>{e.title}</h1>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", fontSize: 14, ...ui.muted }}>
            <span style={badge(statusColor(e.status))}>{e.status}</span>
            <span>
              Added by <b style={{ color: color.ink }}>{e.authorName}</b> ({e.authorPosition}) ·{" "}
              {new Date(e.createdAt).toLocaleString()}
            </span>
          </div>

          <div style={{ ...ui.card, marginTop: 16 }}>
            {e.blocks.length === 0 && <p style={{ margin: 0, ...ui.muted }}>Nothing here yet.</p>}
            {e.blocks.map((b) =>
              b.type === "text" ? (
                <p key={b.id} style={{ whiteSpace: "pre-wrap", margin: "0 0 12px", lineHeight: 1.55 }}>{b.content}</p>
              ) : (
                <figure key={b.id} style={{ margin: "0 0 12px" }}>
                  <a href={`/api/attachments/${b.attachmentId}`} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/api/attachments/${b.attachmentId}`}
                      alt={b.caption || "Screenshot"}
                      style={{ maxWidth: "100%", borderRadius: 10, border: `1px solid ${color.line}`, display: "block" }}
                    />
                  </a>
                  {b.caption && <figcaption style={{ marginTop: 6, fontSize: 14, ...ui.muted }}>{b.caption}</figcaption>}
                </figure>
              )
            )}
          </div>

          <div style={{ display: "flex", gap: 8, margin: "16px 0 8px", alignItems: "center" }}>
            {e.canEdit && (
              <Link
                href={`/errors/${id}/edit`}
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
          {!e.canEdit && <p style={ui.muted}>Only {e.authorName} can edit this entry.</p>}
          <div style={{ height: 32 }} />
        </>
      )}
    </AppShell>
  );
}
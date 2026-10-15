"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

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
  errorText: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  authorName: string;
  authorPosition: string;
  blocks: Block[];
  canEdit: boolean;
  canDelete: boolean;
};

const card = {
  background: "#fff", border: "1px solid #d9d6cc", borderRadius: 14, padding: 16, margin: "12px 0",
} as const;

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
    <main style={{ maxWidth: 720, margin: "0 auto", padding: 24 }}>
      <p style={{ margin: 0 }}><Link href="/errors">&larr; Back to the list</Link></p>

      {msg && <p style={{ color: "#c0392b" }}>{msg}</p>}
      {!e && !msg && <p>Loading...</p>}

      {e && (
        <>
          <h1 style={{ marginBottom: 4 }}>{e.title}</h1>
          <div style={{ color: "#5b6670" }}>
            Added by <b>{e.authorName}</b> ({e.authorPosition}) &middot;{" "}
            {new Date(e.createdAt).toLocaleString()} &middot; {e.status}
          </div>

          {e.errorText && (
            <div style={card}>
              <b>Error message</b>
              <div style={{ marginTop: 4 }}>{e.errorText}</div>
            </div>
          )}

          <div style={card}>
            {e.blocks.length === 0 && <p>No steps yet.</p>}
            {e.blocks.map((b) =>
              b.type === "text" ? (
                <p key={b.id} style={{ whiteSpace: "pre-wrap" }}>{b.content}</p>
              ) : (
                <figure key={b.id} style={{ margin: "12px 0" }}>
                  <a href={`/api/attachments/${b.attachmentId}`} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/api/attachments/${b.attachmentId}`}
                      alt={b.caption || "Screenshot"}
                      style={{ maxWidth: "100%", borderRadius: 10, border: "1px solid #d9d6cc" }}
                    />
                  </a>
                  {b.caption && <figcaption style={{ color: "#5b6670", marginTop: 4 }}>{b.caption}</figcaption>}
                </figure>
              )
            )}
          </div>

          {e.canDelete && (
            <button
              onClick={remove}
              style={{ padding: "10px 16px", borderRadius: 10, color: "#c0392b", border: "1px solid #c0392b", background: "#fff", cursor: "pointer" }}
            >
              Delete
            </button>
          )}
          {!e.canEdit && (
            <p style={{ color: "#5b6670" }}>Only {e.authorName} can edit this entry.</p>
          )}
        </>
      )}
    </main>
  );
}
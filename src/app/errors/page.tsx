"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Row = {
  id: string;
  title: string;
  errorText: string;
  status: string;
  updatedAt: string;
  authorName: string;
  authorPosition: string;
  inPicture: boolean;
};

const card = {
  background: "#fff", border: "1px solid #d9d6cc", borderRadius: 14, padding: 16, margin: "12px 0",
  display: "block", color: "inherit", textDecoration: "none",
} as const;

export default function ErrorsPage() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const timer = setTimeout(async () => {
      const res = await fetch("/api/errors?q=" + encodeURIComponent(q));
      if (res.status === 401) { window.location.href = "/"; return; }
      const data = await res.json().catch(() => ({}));
      if (data.ok) { setRows(data.errors); setMsg(""); }
      else setMsg(data.error ?? "Could not load the errors");
    }, 250);
    return () => clearTimeout(timer);
  }, [q]);

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: 24 }}>
      <p style={{ margin: 0 }}><Link href="/">&larr; Home</Link></p>
            <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "12px 0" }}>
        <h1 style={{ margin: 0, flex: 1 }}>Error library</h1>
        <Link
          href="/errors/new"
          style={{ padding: "8px 14px", borderRadius: 10, background: "#b5541a", color: "#fff", textDecoration: "none", fontWeight: 700 }}
        >
          + Add error
        </Link>
      </div>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search an error title or message"
        autoFocus
        style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid #d9d6cc", boxSizing: "border-box" }}
      />

      {msg && <p style={{ color: "#c0392b" }}>{msg}</p>}
      {rows === null && !msg && <p>Loading...</p>}
      {rows && rows.length === 0 && <p>No errors found.</p>}

      {rows?.map((r) => (
        <Link key={r.id} href={`/errors/${r.id}`} style={card}>
          <b>{r.title}</b>
          <div style={{ marginTop: 8, fontSize: 14, color: "#5b6670" }}>
            <span style={{ border: "1px solid #d9d6cc", borderRadius: 99, padding: "2px 8px", marginRight: 8 }}>
              {r.status}
            </span>
                        {q.trim() && r.inPicture && (
              <span style={{ border: "1px solid #b5541a", color: "#b5541a", borderRadius: 99, padding: "2px 8px", marginRight: 8 }}>
                text found in a picture
              </span>
            )}
            Added by <b>{r.authorName}</b> ({r.authorPosition}) &middot; {new Date(r.updatedAt).toLocaleDateString()}
          </div>
        </Link>
      ))}
    </main>
  );
}
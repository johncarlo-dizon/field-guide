"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Row = {
  id: string;
  title: string;
  updatedAt: string;
  authorName: string;
  authorPosition: string;
  processCount: number;
};

const card = {
  background: "#fff", border: "1px solid #e4e4e4", borderRadius: 16, padding: 16, margin: "12px 0",
  display: "block", color: "inherit", textDecoration: "none",
} as const;

export default function ProceduresPage() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const timer = setTimeout(async () => {
      const res = await fetch("/api/procedures?q=" + encodeURIComponent(q));
      if (res.status === 401) { window.location.href = "/"; return; }
      const data = await res.json().catch(() => ({}));
      if (data.ok) { setRows(data.procedures); setMsg(""); }
      else setMsg(data.error ?? "Could not load the procedures");
    }, 250);
    return () => clearTimeout(timer);
  }, [q]);

  return (
    <div style={{ background: "#f5f5f5", minHeight: "100vh" }}>
      <main style={{ maxWidth: 720, margin: "0 auto", padding: 24 }}>
        <p style={{ margin: 0 }}><Link href="/">&larr; Home</Link></p>
        <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "12px 0" }}>
          <h1 style={{ margin: 0, flex: 1 }}>Procedures</h1>
          <Link
            href="/procedures/new"
            style={{ padding: "8px 14px", borderRadius: 10, background: "#262626", color: "#fff", textDecoration: "none", fontWeight: 600 }}
          >
            + Add procedure
          </Link>
        </div>

        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search a procedure"
          autoFocus
          style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid #e4e4e4", boxSizing: "border-box", font: "inherit" }}
        />

        {msg && <p style={{ color: "#c0392b" }}>{msg}</p>}
        {rows === null && !msg && <p>Loading...</p>}
        {rows && rows.length === 0 && <p>No procedures found.</p>}

        {rows?.map((r) => (
          <Link key={r.id} href={`/procedures/${r.id}`} style={card}>
            <b style={{ fontSize: 18 }}>{r.title}</b>
            <div style={{ marginTop: 8, fontSize: 14, color: "#6b6b6b" }}>
              {r.processCount} {r.processCount === 1 ? "process" : "processes"} &middot; Added by{" "}
              <b>{r.authorName}</b> ({r.authorPosition}) &middot; {new Date(r.updatedAt).toLocaleDateString()}
            </div>
          </Link>
        ))}
      </main>
    </div>
  );
}
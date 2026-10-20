"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { badge, color, statusColor, ui } from "@/lib/ui";

type Row = {
  id: string;
  title: string;
  status: string;
  updatedAt: string;
  authorName: string;
  authorPosition: string;
  inPicture: boolean;
};

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
    <AppShell>
      <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
        <label
          style={{
            flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 10, minHeight: 46, padding: "0 14px",
            borderRadius: 12, border: `1px solid ${color.line}`, background: color.card,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color.mut} strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search errors, steps, screenshots"
            aria-label="Search"
            style={{ flex: 1, minWidth: 0, border: 0, background: "transparent", font: "inherit", color: color.ink, outline: "none" }}
          />
        </label>
        <Link
          href="/errors/new"
          style={{ ...ui.btn, ...ui.dark, display: "flex", alignItems: "center", minHeight: 46, padding: "0 18px", whiteSpace: "nowrap" }}
        >
          + Add error
        </Link>
      </div>

      {msg && <p style={{ color: color.danger }}>{msg}</p>}
      {rows === null && !msg && <p style={ui.muted}>Loading...</p>}
      {rows && rows.length === 0 && <p style={ui.muted}>No errors found.</p>}

      <div style={{ display: "flex", flexDirection: "column", gap: 12, margin: "16px 0 32px" }}>
        {rows?.map((r) => (
          <Link key={r.id} href={`/errors/${r.id}`} style={{ ...ui.card, display: "block", color: "inherit" }}>
            <b style={{ fontSize: 17, lineHeight: 1.3 }}>{r.title}</b>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
              <span style={badge(statusColor(r.status))}>{r.status}</span>
              {q.trim() && r.inPicture && <span style={badge(color.dark)}>text found in a picture</span>}
            </div>
            <div style={{ marginTop: 10, fontSize: 13, ...ui.muted }}>
              Added by <b style={{ color: color.ink }}>{r.authorName}</b> ({r.authorPosition}) · {new Date(r.updatedAt).toLocaleDateString()}
            </div>
          </Link>
        ))}
      </div>
    </AppShell>
  );
}
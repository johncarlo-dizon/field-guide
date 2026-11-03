"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { color, ui } from "@/lib/ui";

type Row = {
  id: string;
  name: string;
  category: string;
  modelNumber: string;
  summary: string;
  partCount: number;
  coverId: string | null;
};

export default function EquipmentPage() {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [cats, setCats] = useState<string[]>([]);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const timer = setTimeout(async () => {
      const params = new URLSearchParams({ q, category });
      const res = await fetch("/api/equipment?" + params.toString());
      if (res.status === 401) { window.location.href = "/"; return; }
      const data = await res.json().catch(() => ({}));
      if (data.ok) { setRows(data.equipment); setCats(data.categories ?? []); setMsg(""); }
      else setMsg(data.error ?? "Could not load the equipment");
    }, 250);
    return () => clearTimeout(timer);
  }, [q, category]);

  const chip = (active: boolean) => ({
    ...ui.btn, ...ui.small, borderRadius: 99, whiteSpace: "nowrap" as const,
    ...(active ? ui.dark : {}),
  });

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
            placeholder="Search equipment"
            aria-label="Search"
            style={{ flex: 1, minWidth: 0, border: 0, background: "transparent", font: "inherit", color: color.ink, outline: "none" }}
          />
        </label>
        <Link
          href="/equipment/new"
          style={{ ...ui.btn, ...ui.dark, display: "flex", alignItems: "center", minHeight: 46, padding: "0 18px", whiteSpace: "nowrap" }}
        >
          + Add equipment
        </Link>
      </div>

      {cats.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
          <button style={chip(category === "")} onClick={() => setCategory("")}>All</button>
          {cats.map((c) => (
            <button key={c} style={chip(category === c)} onClick={() => setCategory(c)}>{c}</button>
          ))}
        </div>
      )}

      {msg && <p style={{ color: color.danger }}>{msg}</p>}
      {rows === null && !msg && <p style={ui.muted}>Loading...</p>}
      {rows && rows.length === 0 && <p style={ui.muted}>No equipment found.</p>}

      <div
        style={{
          display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
          gap: 12, margin: "16px 0 32px",
        }}
      >
        {rows?.map((r) => (
          <Link
            key={r.id} href={`/equipment/${r.id}`}
            style={{ ...ui.card, padding: 0, overflow: "hidden", display: "block", color: "inherit" }}
          >
            <div
              style={{
                aspectRatio: "4 / 3", background: "#eceff3", display: "flex", alignItems: "center",
                justifyContent: "center", color: color.mut, fontSize: 13,
              }}
            >
              {r.coverId ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/api/attachments/${r.coverId}?thumb=1`} alt={r.name} loading="lazy"
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                />
              ) : (
                "No photo yet"
              )}
            </div>
            <div style={{ padding: 12 }}>
              <b style={{ fontSize: 16, lineHeight: 1.3 }}>{r.name}</b>
              {(r.category || r.modelNumber) && (
                <div style={{ marginTop: 4, fontSize: 13, ...ui.muted }}>
                  {[r.category, r.modelNumber].filter(Boolean).join(" · ")}
                </div>
              )}
              {r.summary && (
                <div
                  style={{
                    marginTop: 6, fontSize: 14, lineHeight: 1.4, overflow: "hidden",
                    display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                  }}
                >
                  {r.summary}
                </div>
              )}
              <div style={{ marginTop: 6, fontSize: 12, ...ui.muted }}>
                {r.partCount} {r.partCount === 1 ? "part" : "parts"}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </AppShell>
  );
}
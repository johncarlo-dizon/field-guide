"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { badge, color, ui } from "@/lib/ui";

type Row = {
  userId: string;
  name: string;
  position: string;
  active: boolean;
  errors: number;
  procedures: number;
  equipment: number;
  verified: number;
  total: number;
  isMe: boolean;
};
type Team = { errors: number; procedures: number; equipment: number; total: number };

const RANGES = [
  ["month", "This month"],
  ["90", "Last 90 days"],
  ["year", "This year"],
  ["all", "All time"],
] as const;

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export default function Contributors() {
  const [range, setRange] = useState<string>("month");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      setRows(null);
      const res = await fetch(`/api/contributions?range=${range}`);
      if (res.status === 401) { window.location.href = "/"; return; }
      const data = await res.json().catch(() => ({}));
      if (data.ok) { setRows(data.rows); setTeam(data.team); setMsg(""); }
      else setMsg(data.error ?? "Could not load the contributions");
    })();
  }, [range]);

  const chip = (active: boolean) => ({
    ...ui.btn, ...ui.small, borderRadius: 99, whiteSpace: "nowrap" as const, ...(active ? ui.dark : {}),
  });
  const max = rows && rows.length ? rows[0].total : 1;

  const stat = (label: string, value: number) => (
    <div style={{ ...ui.card, padding: 14, textAlign: "center" }}>
      <div style={{ fontSize: 26, fontWeight: 700, lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 13, marginTop: 4, ...ui.muted }}>{label}</div>
    </div>
  );

  return (
    <AppShell>
      <h1 style={{ margin: "16px 0 4px", fontSize: 26 }}>Contributors</h1>
      <p style={{ margin: 0, fontSize: 14, ...ui.muted }}>
        Who is adding the most to the knowledge hub. Counts what each person added in the period, and not deleted entries.
      </p>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
        {RANGES.map(([key, label]) => (
          <button key={key} style={chip(range === key)} onClick={() => setRange(key)}>{label}</button>
        ))}
      </div>

      {msg && <p style={{ color: color.danger }}>{msg}</p>}
      {rows === null && !msg && <p style={ui.muted}>Loading...</p>}

      {team && rows && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 10, marginTop: 14 }}>
          {stat("Errors", team.errors)}
          {stat("Procedures", team.procedures)}
          {stat("Equipment", team.equipment)}
          {stat("Total added", team.total)}
        </div>
      )}

      {rows && rows.length === 0 && <p style={ui.muted}>Nothing added in this period yet.</p>}

      <div style={{ display: "flex", flexDirection: "column", gap: 10, margin: "14px 0 8px" }}>
        {rows?.map((r, i) => (
          <div key={r.userId} style={{ ...ui.card, opacity: r.active ? 1 : 0.7 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <span
                style={{
                  width: 32, height: 32, borderRadius: "50%", flex: "none", fontWeight: 700, fontSize: 15,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: i < 3 ? color.dark : "#ececec", color: i < 3 ? "#ffffff" : color.ink,
                }}
              >
                {i + 1}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <b style={{ fontSize: 16, overflowWrap: "anywhere" }}>{r.name}</b>
                {r.isMe && <span style={{ ...badge(color.mut), marginLeft: 8 }}>you</span>}
                {!r.active && <span style={{ ...badge(color.mut), marginLeft: 8 }}>inactive</span>}
                <div style={{ fontSize: 13, ...ui.muted }}>{r.position}</div>
              </div>
              <div style={{ textAlign: "right", flex: "none" }}>
                <div style={{ fontSize: 24, fontWeight: 700, lineHeight: 1 }}>{r.total}</div>
                <div style={{ fontSize: 12, ...ui.muted }}>added</div>
              </div>
            </div>

            <div style={{ height: 8, borderRadius: 99, background: "#ececec", marginTop: 12, overflow: "hidden" }}>
              <div style={{ width: `${Math.max(4, Math.round((r.total / max) * 100))}%`, height: "100%", background: color.dark }} />
            </div>

            <div style={{ marginTop: 10, fontSize: 14, ...ui.muted }}>
              {[
                r.errors ? plural(r.errors, "error", "errors") : "",
                r.procedures ? plural(r.procedures, "procedure", "procedures") : "",
                r.equipment ? plural(r.equipment, "equipment item", "equipment items") : "",
              ].filter(Boolean).join(" · ")}
              {r.errors > 0 && (
                <span style={{ ...badge(r.verified ? color.ok : color.mut), marginLeft: 8 }}>
                  {r.verified} verified
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      <p style={{ fontSize: 13, margin: "4px 0 32px", ...ui.muted }}>
        &quot;Verified&quot; counts errors marked as verified, meaning the fix is confirmed to work.
      </p>
    </AppShell>
  );
}
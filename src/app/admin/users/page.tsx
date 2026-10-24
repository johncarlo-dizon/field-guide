"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import { badge, color, ui } from "@/lib/ui";

type U = {
  id: string;
  username: string;
  displayName: string;
  position: string;
  role: "user" | "admin";
  isActive: boolean;
  locked: boolean;
  mustChangePin: boolean;
  isMe: boolean;
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

function Avatar({ name }: { name: string }) {
  return (
    <div
      aria-hidden="true"
      style={{
        width: 44, height: 44, borderRadius: "50%", background: color.dark, color: "#ffffff", flex: "none",
        display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 16,
      }}
    >
      {initials(name)}
    </div>
  );
}

export default function AdminUsers() {
  const [users, setUsers] = useState<U[] | null>(null);
  const [msg, setMsg] = useState("");
  const [denied, setDenied] = useState(false);
  const [q, setQ] = useState("");
  const [notice, setNotice] = useState<{ name: string; pin: string } | null>(null);

  const [showAdd, setShowAdd] = useState(false);
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [position, setPosition] = useState("");
  const [makeAdmin, setMakeAdmin] = useState(false);

  const [editing, setEditing] = useState<string | null>(null);
  const [eName, setEName] = useState("");
  const [ePos, setEPos] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/users");
    if (res.status === 401) { window.location.href = "/"; return; }
    if (res.status === 403) { setDenied(true); return; }
    const data = await res.json().catch(() => ({}));
    if (data.ok) setUsers(data.users);
    else setMsg(data.error ?? "Could not load the users");
  }, []);

  useEffect(() => { load(); }, [load]);

  async function act(u: U, action: string, ask?: string, extra?: object) {
    if (ask && !confirm(ask)) return;
    setMsg("");
    const res = await fetch(`/api/admin/users/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...extra }),
    });
    const data = await res.json().catch(() => ({}));
    if (!data.ok) { setMsg(data.error ?? "That did not work"); return; }
    if (data.tempPin) setNotice({ name: u.displayName, pin: data.tempPin });
    setEditing(null);
    load();
  }

  async function addUser() {
    setMsg("");
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, displayName: name, position, role: makeAdmin ? "admin" : "user" }),
    });
    const data = await res.json().catch(() => ({}));
    if (!data.ok) { setMsg(data.error ?? "Could not add the user"); return; }
    setNotice({ name, pin: data.tempPin });
    setUsername(""); setName(""); setPosition(""); setMakeAdmin(false); setShowAdd(false);
    load();
  }

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!users || !s) return users;
    return users.filter((u) => `${u.displayName} ${u.position} ${u.username}`.toLowerCase().includes(s));
  }, [users, q]);

  if (denied) {
    return (
      <AppShell>
        <p style={{ marginTop: 20, ...ui.muted }}>Only admins can open this page.</p>
      </AppShell>
    );
  }

  const small = { ...ui.btn, ...ui.small };
  const canAdd = !!username && !!name && !!position;

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
            placeholder="Search people"
            aria-label="Search people"
            style={{ flex: 1, minWidth: 0, border: 0, background: "transparent", font: "inherit", color: color.ink, outline: "none" }}
          />
        </label>
        <button
          onClick={() => setShowAdd((v) => !v)}
          style={{ ...ui.btn, ...ui.dark, minHeight: 46, padding: "0 18px", whiteSpace: "nowrap" }}
        >
          {showAdd ? "Close" : "+ Add user"}
        </button>
      </div>

      {notice && (
        <div style={{ ...ui.card, marginTop: 16, background: "#fff8e5", borderColor: "#f0d98a" }}>
          Temporary PIN for <b>{notice.name}</b>
          <div style={{ fontSize: 32, fontWeight: 700, letterSpacing: 8, margin: "8px 0" }}>{notice.pin}</div>
          <p style={{ margin: "0 0 12px", fontSize: 14, ...ui.muted }}>
            Give it to them now. It is shown only once, and they choose their own PIN the first time they log in.
          </p>
          <button style={small} onClick={() => setNotice(null)}>Done</button>
        </div>
      )}

      {showAdd && (
        <div style={{ ...ui.card, marginTop: 16 }}>
          <b style={{ fontSize: 17 }}>New user</b>
          <label style={{ display: "block", marginTop: 14, fontWeight: 600, fontSize: 14 }}>
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} placeholder="Jose Santos" style={{ ...ui.field, marginTop: 6, fontWeight: 400 }} />
          </label>
          <label style={{ display: "block", marginTop: 14, fontWeight: 600, fontSize: 14 }}>
            Position
            <input value={position} onChange={(e) => setPosition(e.target.value)} maxLength={100} placeholder="Field Support" style={{ ...ui.field, marginTop: 6, fontWeight: 400 }} />
          </label>
          <label style={{ display: "block", marginTop: 14, fontWeight: 600, fontSize: 14 }}>
            Username
            <input
              value={username} onChange={(e) => setUsername(e.target.value.toLowerCase())} maxLength={30}
              placeholder="jose" style={{ ...ui.field, marginTop: 6, fontWeight: 400 }}
            />
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14 }}>
            <input type="checkbox" checked={makeAdmin} onChange={(e) => setMakeAdmin(e.target.checked)} />
            Make this person an admin
          </label>
          <button
            onClick={addUser} disabled={!canAdd}
            style={{ ...ui.btn, ...ui.dark, width: "100%", minHeight: 48, marginTop: 16, opacity: canAdd ? 1 : 0.5 }}
          >
            Create and show temporary PIN
          </button>
        </div>
      )}

      {msg && <p style={{ color: color.danger }}>{msg}</p>}
      {!users && !msg && <p style={ui.muted}>Loading...</p>}
      {shown && shown.length === 0 && <p style={ui.muted}>No one matches that.</p>}

      <div style={{ display: "flex", flexDirection: "column", gap: 12, margin: "16px 0 32px" }}>
        {shown?.map((u) => (
          <div key={u.id} style={{ ...ui.card, opacity: u.isActive ? 1 : 0.65 }}>
            {editing === u.id ? (
              <>
                <input value={eName} onChange={(e) => setEName(e.target.value)} maxLength={100} aria-label="Name" style={ui.field} />
                <input value={ePos} onChange={(e) => setEPos(e.target.value)} maxLength={100} aria-label="Position" style={{ ...ui.field, marginTop: 8 }} />
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  <button style={{ ...small, ...ui.dark }} onClick={() => act(u, "update", undefined, { displayName: eName, position: ePos })}>Save</button>
                  <button style={small} onClick={() => setEditing(null)}>Cancel</button>
                </div>
              </>
            ) : (
              <>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <Avatar name={u.displayName} />
                  <div style={{ minWidth: 0 }}>
                    <b style={{ fontSize: 17 }}>{u.displayName}</b>
                    <div style={{ fontSize: 14, ...ui.muted }}>{u.position} · {u.username}</div>
                  </div>
                </div>

                {(u.role === "admin" || !u.isActive || u.locked || u.mustChangePin || u.isMe) && (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12 }}>
                    {u.role === "admin" && <span style={badge(color.dark)}>admin</span>}
                    {!u.isActive && <span style={badge(color.danger)}>deactivated</span>}
                    {u.locked && <span style={badge(color.danger)}>locked</span>}
                    {u.mustChangePin && <span style={badge(color.mut)}>has not set own PIN</span>}
                    {u.isMe && <span style={badge(color.mut)}>you</span>}
                  </div>
                )}

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
                  <button style={small} onClick={() => { setEditing(u.id); setEName(u.displayName); setEPos(u.position); }}>Edit</button>
                  <button style={small} onClick={() => act(u, "reset-pin", `Reset the PIN for ${u.displayName}? They will be logged out.`)}>Reset PIN</button>
                  {u.locked && <button style={small} onClick={() => act(u, "unlock")}>Unlock</button>}
                  {!u.isMe && (
                    u.isActive ? (
                      <button
                        style={{ ...small, color: color.danger, borderColor: color.danger, background: color.card }}
                        onClick={() => act(u, "deactivate", `Deactivate ${u.displayName}? They can no longer log in. Their entries stay.`)}
                      >
                        Deactivate
                      </button>
                    ) : (
                      <button style={small} onClick={() => act(u, "activate")}>Activate</button>
                    )
                  )}
                  {!u.isMe && (
                    u.role === "admin" ? (
                      <button style={small} onClick={() => act(u, "make-user", `Remove admin rights from ${u.displayName}?`)}>Make regular user</button>
                    ) : (
                      <button style={small} onClick={() => act(u, "make-admin", `Make ${u.displayName} an admin?`)}>Make admin</button>
                    )
                  )}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </AppShell>
  );
}
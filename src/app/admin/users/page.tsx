"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

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

const ui = {
  card: { background: "#fff", border: "1px solid #e4e4e4", borderRadius: 16, padding: 16, margin: "12px 0" },
  field: {
    width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #e4e4e4",
    background: "#fafafa", marginTop: 6, boxSizing: "border-box", font: "inherit",
  },
  btn: {
    padding: "8px 12px", borderRadius: 10, border: "1px solid #e4e4e4", background: "#fafafa",
    color: "#171717", cursor: "pointer", font: "inherit", fontSize: 14, fontWeight: 600,
  },
  dark: { background: "#262626", color: "#fff", border: "1px solid #262626" },
  badge: { border: "1px solid #e4e4e4", borderRadius: 99, padding: "2px 8px", fontSize: 12, marginRight: 6 },
} as const;

export default function AdminUsers() {
  const [users, setUsers] = useState<U[] | null>(null);
  const [msg, setMsg] = useState("");
  const [denied, setDenied] = useState(false);
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

  if (denied) {
    return (
      <main style={{ maxWidth: 720, margin: "0 auto", padding: 24 }}>
        <p style={{ margin: 0 }}><Link href="/">&larr; Home</Link></p>
        <p>Only admins can open this page.</p>
      </main>
    );
  }

  return (
    <div style={{ background: "#f5f5f5", minHeight: "100vh" }}>
      <main style={{ maxWidth: 720, margin: "0 auto", padding: 24 }}>
        <p style={{ margin: 0 }}><Link href="/">&larr; Home</Link></p>
        <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "12px 0" }}>
          <h1 style={{ margin: 0, flex: 1 }}>Users</h1>
          <button style={{ ...ui.btn, ...ui.dark }} onClick={() => setShowAdd((v) => !v)}>
            {showAdd ? "Close" : "+ Add user"}
          </button>
        </div>

        {notice && (
          <div style={{ ...ui.card, background: "#fff8e5", borderColor: "#f0d98a" }}>
            Temporary PIN for <b>{notice.name}</b>: <b style={{ fontSize: 22, letterSpacing: 4 }}>{notice.pin}</b>
            <p style={{ margin: "8px 0" }}>
              Give it to them now. It is shown only once, and they choose their own PIN at the first login.
            </p>
            <button style={ui.btn} onClick={() => setNotice(null)}>Done</button>
          </div>
        )}

        {showAdd && (
          <div style={ui.card}>
            <label>
              <b>Name</b>
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} style={ui.field} placeholder="Jose Santos" />
            </label>
            <label style={{ display: "block", marginTop: 12 }}>
              <b>Position</b>
              <input value={position} onChange={(e) => setPosition(e.target.value)} maxLength={100} style={ui.field} placeholder="Field Support" />
            </label>
            <label style={{ display: "block", marginTop: 12 }}>
              <b>Username</b>
              <input
                value={username} onChange={(e) => setUsername(e.target.value.toLowerCase())} maxLength={30}
                style={ui.field} placeholder="jose"
              />
            </label>
            <label style={{ display: "block", marginTop: 12 }}>
              <input type="checkbox" checked={makeAdmin} onChange={(e) => setMakeAdmin(e.target.checked)} /> Make this person an admin
            </label>
            <button
              style={{ ...ui.btn, ...ui.dark, marginTop: 12, opacity: username && name && position ? 1 : 0.5 }}
              disabled={!username || !name || !position} onClick={addUser}
            >
              Create and show temporary PIN
            </button>
          </div>
        )}

        {msg && <p style={{ color: "#c0392b" }}>{msg}</p>}
        {!users && !msg && <p>Loading...</p>}

        {users?.map((u) => (
          <div key={u.id} style={{ ...ui.card, opacity: u.isActive ? 1 : 0.6 }}>
            {editing === u.id ? (
              <>
                <input value={eName} onChange={(e) => setEName(e.target.value)} maxLength={100} style={ui.field} />
                <input value={ePos} onChange={(e) => setEPos(e.target.value)} maxLength={100} style={ui.field} />
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <button style={{ ...ui.btn, ...ui.dark }} onClick={() => act(u, "update", undefined, { displayName: eName, position: ePos })}>Save</button>
                  <button style={ui.btn} onClick={() => setEditing(null)}>Cancel</button>
                </div>
              </>
            ) : (
              <>
                <div>
                  <b style={{ fontSize: 17 }}>{u.displayName}</b>{" "}
                  <span style={{ color: "#6b6b6b" }}>({u.position})</span>
                </div>
                <div style={{ margin: "6px 0 10px", color: "#6b6b6b", fontSize: 14 }}>
                  {u.username}{" "}
                  {u.role === "admin" && <span style={{ ...ui.badge, color: "#262626" }}>admin</span>}
                  {!u.isActive && <span style={{ ...ui.badge, color: "#c0392b" }}>deactivated</span>}
                  {u.locked && <span style={{ ...ui.badge, color: "#c0392b" }}>locked</span>}
                  {u.mustChangePin && <span style={ui.badge}>has not set own PIN</span>}
                  {u.isMe && <span style={ui.badge}>you</span>}
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button style={ui.btn} onClick={() => { setEditing(u.id); setEName(u.displayName); setEPos(u.position); }}>Edit</button>
                  <button style={ui.btn} onClick={() => act(u, "reset-pin", `Reset the PIN for ${u.displayName}? They will be logged out.`)}>Reset PIN</button>
                  {u.locked && <button style={ui.btn} onClick={() => act(u, "unlock")}>Unlock</button>}
                  {!u.isMe && (
                    u.isActive
                      ? <button style={{ ...ui.btn, color: "#c0392b" }} onClick={() => act(u, "deactivate", `Deactivate ${u.displayName}? They can no longer log in. Their entries stay.`)}>Deactivate</button>
                      : <button style={ui.btn} onClick={() => act(u, "activate")}>Activate</button>
                  )}
                  {!u.isMe && (
                    u.role === "admin"
                      ? <button style={ui.btn} onClick={() => act(u, "make-user", `Remove admin rights from ${u.displayName}?`)}>Make regular user</button>
                      : <button style={ui.btn} onClick={() => act(u, "make-admin", `Make ${u.displayName} an admin?`)}>Make admin</button>
                  )}
                </div>
              </>
            )}
          </div>
        ))}
      </main>
    </div>
  );
}
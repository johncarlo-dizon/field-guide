"use client";
import Link from "next/link";

import { useCallback, useEffect, useState } from "react";

type Me = { id: string; displayName: string; position: string; role: string; mustChangePin: boolean };
type Person = { id: string; displayName: string; position: string };
type Reply = { status: number; ok?: boolean; error?: string; user?: Me; people?: Person[] };

async function api(url: string, body?: unknown): Promise<Reply> {
  const res = await fetch(
    url,
    body === undefined
      ? {}
      : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
  );
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ...data };
}

const card = {
  background: "#fff", border: "1px solid #d9d6cc", borderRadius: 14, padding: 16, margin: "12px 0",
} as const;
const input = { width: "100%", padding: 10, borderRadius: 10, border: "1px solid #d9d6cc", marginTop: 6, boxSizing: "border-box" } as const;
const button = { padding: "10px 16px", borderRadius: 10, marginTop: 12, cursor: "pointer" } as const;

export default function Home() {
  const [me, setMe] = useState<Me | null | undefined>(undefined); // undefined = loading
  const [people, setPeople] = useState<Person[]>([]);
  const [userId, setUserId] = useState("");
  const [pin, setPin] = useState("");
  const [curPin, setCurPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [newPin2, setNewPin2] = useState("");
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const m = await api("/api/auth/me");
    if (m.ok && m.user) { setMe(m.user); return; }
    setMe(null);
    const u = await api("/api/auth/users");
    setPeople(u.people ?? []);
    if (!u.ok) setMsg(u.error ?? "Cannot reach the API");
  }, []);

  useEffect(() => { load(); }, [load]);

  async function login() {
    setMsg("");
    const r = await api("/api/auth/login", { userId, pin });
    setPin("");
    if (r.ok && r.user) setMe(r.user);
    else setMsg(r.error ?? "Login failed");
  }

  async function logout() {
    await api("/api/auth/logout", {});
    setMe(null); setMsg("");
    load();
  }

  async function changePin() {
    setMsg("");
    if (newPin !== newPin2) { setMsg("The two new PINs do not match"); return; }
    const r = await api("/api/auth/change-pin", { currentPin: curPin, newPin });
    if (r.ok) { setCurPin(""); setNewPin(""); setNewPin2(""); load(); }
    else setMsg(r.error ?? "Could not change the PIN");
  }

  const pinField = (value: string, set: (v: string) => void, label: string) => (
    <label style={{ display: "block", marginTop: 10 }}>
      {label}
      <input
        type="password" inputMode="numeric" maxLength={4} autoComplete="off"
        value={value} onChange={(e) => set(e.target.value.replace(/\D/g, ""))} style={input}
      />
    </label>
  );

  return (
    <main style={{ maxWidth: 520, margin: "0 auto", padding: 24 }}>
      <h1 style={{ marginBottom: 4 }}>FieldGuide</h1>
      <p style={{ marginTop: 0, color: "#5b6670" }}>Field support knowledge base</p>

      {me === undefined && <p>Loading...</p>}

      {me === null && (
        <div style={card}>
          <b>Log in</b>
          {people.length === 0 ? (
            <p>No users yet. Run <code>npm run db:seed</code> to create the admin.</p>
          ) : (
            <>
              <label style={{ display: "block", marginTop: 10 }}>
                Your name
                <select value={userId} onChange={(e) => setUserId(e.target.value)} style={input}>
                  <option value="">Select...</option>
                  {people.map((p) => (
                    <option key={p.id} value={p.id}>{p.displayName} - {p.position}</option>
                  ))}
                </select>
              </label>
              {pinField(pin, setPin, "4-digit PIN")}
              <button style={button} onClick={login} disabled={!userId || pin.length !== 4}>Log in</button>
            </>
          )}
          {msg && <p style={{ color: "#c0392b" }}>{msg}</p>}
        </div>
      )}

      {me && me.mustChangePin && (
        <div style={card}>
          <b>Set your own PIN</b>
          <p style={{ color: "#5b6670" }}>You are using a temporary PIN. Choose a new 4-digit PIN that is hard to guess.</p>
          {pinField(curPin, setCurPin, "Current (temporary) PIN")}
          {pinField(newPin, setNewPin, "New PIN")}
          {pinField(newPin2, setNewPin2, "Repeat new PIN")}
          <button style={button} onClick={changePin} disabled={curPin.length !== 4 || newPin.length !== 4}>Save new PIN</button>
          {msg && <p style={{ color: "#c0392b" }}>{msg}</p>}
        </div>
      )}

      {me && !me.mustChangePin && (
        <div style={card}>
          <b>Welcome, {me.displayName}</b>
          <p style={{ margin: "4px 0", color: "#5b6670" }}>{me.position}{me.role === "admin" ? " (admin)" : ""}</p>
          <p><Link href="/errors">Open the error library</Link></p>
<p><Link href="/procedures">Open the procedures</Link></p>
          <button style={button} onClick={logout}>Log out</button>
        </div>
      )}
    </main>
  );
}
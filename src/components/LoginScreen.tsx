"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { color, ui } from "@/lib/ui";
type Me = { id: string; displayName: string; position: string; role: string; mustChangePin: boolean };
type Person = { id: string; displayName: string; position: string };
type Reply = { status: number; ok?: boolean; error?: string; user?: Me };

const LAST = "fg_last_user";

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

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0];
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

function Avatar({ name, size }: { name: string; size: number }) {
  return (
    <div
      aria-hidden="true"
      style={{
        width: size, height: size, borderRadius: "50%", background: color.dark, color: "#ffffff",
        display: "flex", alignItems: "center", justifyContent: "center", flex: "none",
        fontWeight: 700, fontSize: Math.round(size * 0.36),
      }}
    >
      {initials(name)}
    </div>
  );
}

function Logo() {
  return (
    <div style={{ textAlign: "center" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/logo.png" alt="Alfamart" style={{ height: 48, width: "auto" }} />
      <div style={{ marginTop: 8, fontSize: 15, fontWeight: 600, ...ui.muted }}>Field Support Knowledge Base</div>
    </div>
  );
}

// Four boxes that show dots, used on the "set your own PIN" screen.
function PinBoxes({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [focus, setFocus] = useState(false);
  const active = Math.min(value.length, 3);
  return (
    <div style={{ marginTop: 18 }}>
      <div style={{ fontWeight: 600, fontSize: 14 }}>{label}</div>
      <div
        onClick={() => ref.current?.focus()}
        style={{ position: "relative", display: "flex", gap: 10, marginTop: 8, cursor: "text" }}
      >
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              flex: 1, height: 56, borderRadius: 12, background: color.faint,
              border: `1.5px solid ${focus && i === active ? color.dark : color.line}`,
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, lineHeight: 1,
            }}
          >
            {value[i] ? "•" : ""}
          </div>
        ))}
        <input
          ref={ref}
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={4}
          autoComplete="off"
          aria-label={label}
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, fontSize: 16, cursor: "text" }}
        />
      </div>
    </div>
  );
}

function Alert({ text }: { text: string }) {
  return (
    <div style={{ marginTop: 16, padding: "10px 12px", borderRadius: 10, background: "#fdecea", color: "#9b2c20", fontSize: 14 }}>
      {text}
    </div>
  );
}

const primary = {
  ...ui.btn, ...ui.dark, width: "100%", minHeight: 52, marginTop: 22, fontSize: 16, fontWeight: 700,
} as const;

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "back"];

export default function LoginScreen({ people, user }: { people: Person[]; user: Me | null }) {
  const router = useRouter();

  // When set, the person must still choose their own PIN.
  const [me, setMe] = useState<Me | null>(user);
  const [ready, setReady] = useState(!!user);

  const [selected, setSelected] = useState<Person | null>(null);
  const [remembered, setRemembered] = useState(false);
  const [query, setQuery] = useState("");
  const [pin, setPin] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(false);

  const [curPin, setCurPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [newPin2, setNewPin2] = useState("");

  // Refs so the keyboard handler always sees the current values.
  const pinRef = useRef("");
  const busyRef = useRef(false);
  const selRef = useRef<Person | null>(null);

  function setPinBoth(v: string) {
    pinRef.current = v;
    setPin(v);
  }
  function setBusyBoth(v: boolean) {
    busyRef.current = v;
    setBusy(v);
  }
  function choose(p: Person | null) {
    selRef.current = p;
    setSelected(p);
    setPinBoth("");
    setMsg("");
  }

  // Open straight on the PIN step for the person who logged in last on this device.
  useEffect(() => {
    if (!user) {
      try {
        const id = localStorage.getItem(LAST);
        const p = people.find((x) => x.id === id);
        if (p) { choose(p); setRemembered(true); }
      } catch { /* storage not available */ }
    }
    setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function notYou() {
    if (busyRef.current) return;
    try { localStorage.removeItem(LAST); } catch { /* ignore */ }
    setRemembered(false);
    setQuery("");
    choose(null);
  }

  async function submit(p: string) {
    const person = selRef.current;
    if (!person) return;
    setBusyBoth(true);
    setMsg("");
    const r = await api("/api/auth/login", { userId: person.id, pin: p });
    if (r.ok && r.user) {
      try { localStorage.setItem(LAST, person.id); } catch { /* ignore */ }
      if (r.user.mustChangePin) {
        setBusyBoth(false);
        setPinBoth("");
        setMe(r.user);
      } else {
        router.replace("/errors"); // stays busy until the page changes
      }
      return;
    }
    setBusyBoth(false);
    setPinBoth("");
    setMsg(r.error ?? "Login failed");
    setShake(true);
    setTimeout(() => setShake(false), 450);
  }

  function press(d: string) {
    if (busyRef.current || !selRef.current) return;
    const next = (pinRef.current + d).slice(0, 4);
    setPinBoth(next);
    setMsg("");
    if (next.length === 4) submit(next);
  }
  function back() {
    if (busyRef.current) return;
    setPinBoth(pinRef.current.slice(0, -1));
  }

  // Typing on a physical keyboard works too.
  useEffect(() => {
    if (!selected || me) return;
    function onKey(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (/^[0-9]$/.test(e.key)) { e.preventDefault(); press(e.key); }
      else if (e.key === "Backspace") { e.preventDefault(); back(); }
      else if (e.key === "Escape") { notYou(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, me]);

  async function changePin() {
    setMsg("");
    if (newPin !== newPin2) { setMsg("The two new PINs do not match"); return; }
    setBusyBoth(true);
    const r = await api("/api/auth/change-pin", { currentPin: curPin, newPin });
    if (r.ok) router.replace("/errors");
    else { setBusyBoth(false); setMsg(r.error ?? "Could not change the PIN"); }
  }

  async function logout() {
    await api("/api/auth/logout", {});
    window.location.href = "/";
  }

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? people.filter((p) => (p.displayName + " " + p.position).toLowerCase().includes(q)) : people;
  }, [people, query]);

  const changeReady = curPin.length === 4 && newPin.length === 4 && newPin2.length === 4 && !busy;
  const firstName = selected ? selected.displayName.trim().split(/\s+/)[0] : "";

  return (
    <div className="lg-page">
      <div className={"lg-wrap" + (!me && !selected ? " wide" : "")}>
        <Logo />

        {!ready ? null : me ? (
          /* ---------- choose your own PIN ---------- */
          <form
            onSubmit={(e) => { e.preventDefault(); if (changeReady) changePin(); }}
                       style={{ ...ui.card, padding: 28, width: "100%", maxWidth: 380, marginTop: 28, boxShadow: "0 8px 24px rgba(0,0,0,0.06)" }}
          >
            <h1 style={{ margin: 0, fontSize: 24 }}>Set your own PIN</h1>
            <p style={{ margin: "6px 0 0", ...ui.muted }}>
              Hi {me.displayName}. You are using a temporary PIN. Choose a new 4-digit PIN that is hard to guess.
            </p>
            <PinBoxes label="Current (temporary) PIN" value={curPin} onChange={setCurPin} />
            <PinBoxes label="New PIN" value={newPin} onChange={setNewPin} />
            <PinBoxes label="Repeat new PIN" value={newPin2} onChange={setNewPin2} />
            <button type="submit" disabled={!changeReady} style={{ ...primary, opacity: changeReady ? 1 : 0.5 }}>
              {busy ? "Saving..." : "Save new PIN"}
            </button>
            <button type="button" onClick={logout} style={{ ...ui.btn, width: "100%", marginTop: 10 }}>
              Cancel and log out
            </button>
            {msg && <Alert text={msg} />}
          </form>
        ) : selected ? (
          /* ---------- PIN step ---------- */
          <div className="lg-center">
            <Avatar name={selected.displayName} size={72} />
            <h1 style={{ margin: "14px 0 2px", fontSize: 24, textAlign: "center" }}>
              {remembered ? `Welcome back, ${firstName}` : `Hi, ${firstName}`}
            </h1>
            <div style={{ ...ui.muted, fontSize: 14 }}>{selected.position}</div>

            <div className={shake ? "lg-dots lg-shake" : "lg-dots"} aria-label={`${pin.length} of 4 digits entered`}>
              {[0, 1, 2, 3].map((i) => (
                <span key={i} className={i < pin.length ? "lg-dot on" : "lg-dot"} />
              ))}
            </div>
            <div className="lg-msg" role="alert">{busy ? "Checking..." : msg}</div>

            <div className="lg-pad">
              {KEYS.map((k, i) =>
                k === "" ? (
                  <span key={i} />
                ) : k === "back" ? (
                  <button key={i} type="button" className="lg-key" aria-label="Delete" onClick={back} disabled={busy}>
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M21 5H9l-6 7 6 7h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1z" />
                      <path d="m17 9-5 5M12 9l5 5" />
                    </svg>
                  </button>
                ) : (
                  <button key={i} type="button" className="lg-key" onClick={() => press(k)} disabled={busy}>
                    {k}
                  </button>
                )
              )}
            </div>

            <button type="button" className="lg-link" onClick={notYou}>Not you?</button>
          </div>
        ) : (
          /* ---------- pick your name ---------- */
          <>
            <h1 className="lg-title">Who is logging in?</h1>
            <div style={{ ...ui.muted, fontSize: 15 }}>Tap your name</div>

            {people.length > 8 && (
              <input
                className="lg-search"
                placeholder="Find your name"
                aria-label="Find your name"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            )}

            {people.length === 0 && (
              <p style={ui.muted}>No users yet. Run <code>npm run db:seed</code> to create the first user.</p>
            )}
            {people.length > 0 && shown.length === 0 && <p style={ui.muted}>No one matches that.</p>}

            <div className="lg-grid">
              {shown.map((p) => (
                <button key={p.id} type="button" className="lg-person" onClick={() => choose(p)}>
                  <Avatar name={p.displayName} size={56} />
                  <b style={{ fontSize: 15 }}>{p.displayName}</b>
                  <span style={{ fontSize: 13, ...ui.muted }}>{p.position}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
      <small className="lg-foot">Internal use only</small>
    </div>
  );
}
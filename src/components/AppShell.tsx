"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { color, ui } from "@/lib/ui";

type Me = { id: string; displayName: string; position: string; role: string };

export default function AppShell({ children }: { children: ReactNode }) {
  const path = usePathname() ?? "";
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/auth/me");
      if (res.status === 401) { window.location.href = "/"; return; }
      const data = await res.json().catch(() => ({}));
      if (data.ok) setMe(data.user);
    })();
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  }

  const tabs = [
    { href: "/errors", label: "Errors" },
    { href: "/procedures", label: "Procedures" },
    ...(me?.role === "admin" ? [{ href: "/admin/users", label: "Users" }] : []),
  ];

  return (
    <div style={{ minHeight: "100vh", background: color.bg }}>
      <header style={{ background: color.card, borderBottom: `1px solid ${color.line}` }}>
        <div
          style={{
            maxWidth: 720, margin: "0 auto", padding: "14px 20px",
            display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
          }}
        >
          <Link
            href="/errors"
            style={{ flex: 1, display: "flex", alignItems: "center", gap: 10, fontSize: 20, fontWeight: 700, color: color.ink, textDecoration: "none" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logo.png" alt="Alfamart" style={{ height: 28, width: "auto" }} />
            <span>Field IT Knowledge Hub</span>
          </Link>
          {me && <span style={{ fontSize: 14, ...ui.muted }}>{me.displayName} · {me.position}</span>}
          <button onClick={logout} style={{ ...ui.btn, ...ui.small }}>Log out</button>
        </div>
      </header>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 20px" }}>
                <nav style={{ paddingTop: 16, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "inline-flex", gap: 4, padding: 4, borderRadius: 14, background: "#ebebeb" }}>
            {tabs.map((t) => {
              const active = path === t.href || path.startsWith(t.href + "/");
              return (
                <Link
                  key={t.href}
                  href={t.href}
                  style={{
                    padding: "8px 20px", borderRadius: 10, fontSize: 15, fontWeight: 600,
                    background: active ? color.dark : "transparent",
                    color: active ? "#ffffff" : color.ink,
                  }}
                >
                  {t.label}
                </Link>
              );
            })}
          </div>
                   <a href="/api/export/offline" download style={{ ...ui.btn, ...ui.small }}>Offline copy</a>
        </nav>
        {children}
      </div>
    </div>
  );
}
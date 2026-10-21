import type { CSSProperties } from "react";

export const color = {
  bg: "#f5f5f5",
  card: "#ffffff",
  faint: "#fafafa",
  line: "#e4e4e4",
  ink: "#171717",
  mut: "#5f5f5f",
  dark: "#262626",
  ok: "#1f7a46",
  warn: "#9a6a00",
  danger: "#c0392b",
} as const;

export const ui = {
  card: { background: color.card, border: `1px solid ${color.line}`, borderRadius: 16, padding: 16 },
  field: {
    width: "100%", padding: "12px 14px", borderRadius: 12, border: `1px solid ${color.line}`,
    background: color.faint, boxSizing: "border-box", font: "inherit", color: color.ink,
  },
  btn: {
    boxSizing: "border-box",
    padding: "10px 14px", borderRadius: 12, border: `1px solid ${color.line}`, background: color.faint,
    color: color.ink, cursor: "pointer", font: "inherit", fontWeight: 600, textDecoration: "none",
  },
  dark: { background: color.dark, color: "#ffffff", border: `1px solid ${color.dark}` },
  small: { padding: "6px 10px", fontSize: 14, fontWeight: 500 },
  muted: { color: color.mut },
} satisfies Record<string, CSSProperties>;

export const badge = (c: string): CSSProperties => ({
  fontSize: 12, fontWeight: 600, padding: "3px 10px", borderRadius: 99, border: `1px solid ${c}`, color: c,
});

export const statusColor = (s: string) =>
  s === "verified" ? color.ok : s === "outdated" ? color.warn : color.mut;
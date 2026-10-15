import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export const dynamic = "force-dynamic";

// Temporary table for testing read and write. Replace with real migrations later.
const ENSURE_TABLE = `
  CREATE TABLE IF NOT EXISTS connection_pings (
    id SERIAL PRIMARY KEY,
    note TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;

function fail(e: unknown) {
  return NextResponse.json(
    { ok: false, error: e instanceof Error ? e.message : "Unknown error" },
    { status: 500 }
  );
}

// GET /api/ping -> last 5 test rows
export async function GET() {
  try {
    await pool.query(ENSURE_TABLE);
    const r = await pool.query(
      "SELECT id, note, created_at FROM connection_pings ORDER BY id DESC LIMIT 5"
    );
    return NextResponse.json({ ok: true, pings: r.rows });
  } catch (e) {
    return fail(e);
  }
}

// POST /api/ping { "note": "..." } -> saves one test row
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const note = String(body.note ?? "hello from FieldGuide").slice(0, 200);
    await pool.query(ENSURE_TABLE);
    const r = await pool.query(
      "INSERT INTO connection_pings (note) VALUES ($1) RETURNING id, note, created_at",
      [note]
    );
    return NextResponse.json({ ok: true, ping: r.rows[0] }, { status: 201 });
  } catch (e) {
    return fail(e);
  }
}

import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/health  -> checks that the API can reach PostgreSQL
export async function GET() {
  try {
    const r = await pool.query(
      "SELECT now() AS server_time, current_database() AS database"
    );
    return NextResponse.json({ ok: true, app: "FieldGuide", ...r.rows[0] });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        app: "FieldGuide",
        error: e instanceof Error ? e.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

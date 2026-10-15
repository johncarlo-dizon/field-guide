import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/db/schema";

export const dynamic = "force-dynamic";

// GET /api/auth/users -> names for the login picker (no PINs, no usernames)
export async function GET() {
  try {
    const people = await db
      .select({ id: users.id, displayName: users.displayName, position: users.position })
      .from(users)
      .where(eq(users.isActive, true))
      .orderBy(asc(users.displayName));
    return NextResponse.json({ ok: true, people });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
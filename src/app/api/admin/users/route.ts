import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/db/schema";
import { requireAdmin } from "@/lib/admin";
import { hashPin, randomPin } from "@/lib/pin";
import { cleanText } from "@/lib/error-input";

export const dynamic = "force-dynamic";

function fail(e: unknown) {
  return NextResponse.json(
    { ok: false, error: e instanceof Error ? e.message : "Unknown error" },
    { status: 500 }
  );
}

// GET /api/admin/users -> everyone, including deactivated and locked accounts
export async function GET() {
  try {
    const a = await requireAdmin();
    if ("error" in a) return a.error;

    const rows = await db.select().from(users).orderBy(asc(users.displayName));
    const now = Date.now();
    return NextResponse.json({
      ok: true,
      users: rows.map((u) => ({
        id: u.id,
        username: u.username,
        displayName: u.displayName,
        position: u.position,
        role: u.role,
        isActive: u.isActive,
        locked: !!u.lockedUntil && u.lockedUntil.getTime() > now,
        mustChangePin: u.mustChangePin,
        isMe: u.id === a.me.id,
      })),
    });
  } catch (e) {
    return fail(e);
  }
}

// POST /api/admin/users { username, displayName, position, role? } -> returns the temporary PIN once
export async function POST(req: Request) {
  try {
    const a = await requireAdmin();
    if ("error" in a) return a.error;

    const body = await req.json().catch(() => ({}));
    const username = typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
    const displayName = cleanText(body.displayName, 100);
    const position = cleanText(body.position, 100);

    if (!/^[a-z0-9._-]{2,30}$/.test(username)) {
      return NextResponse.json(
        { ok: false, error: "The username must be 2 to 30 characters: letters, numbers, dot, dash or underscore" },
        { status: 400 }
      );
    }
    if (!displayName || !position) {
      return NextResponse.json({ ok: false, error: "Name and position are required" }, { status: 400 });
    }

    const [exists] = await db.select({ id: users.id }).from(users).where(eq(users.username, username)).limit(1);
    if (exists) {
      return NextResponse.json({ ok: false, error: `The username "${username}" is already taken` }, { status: 409 });
    }

    const tempPin = randomPin();
    const [row] = await db
      .insert(users)
      .values({
        username,
        displayName,
        position,
        role: body.role === "admin" ? "admin" : "user",
        pinHash: await hashPin(tempPin),
        mustChangePin: true,
      })
      .returning({ id: users.id });

    return NextResponse.json({ ok: true, id: row.id, tempPin }, { status: 201 });
  } catch (e) {
    return fail(e);
  }
}
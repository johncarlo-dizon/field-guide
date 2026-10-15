import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { users } from "@/db/schema";
import { verifyPin } from "@/lib/pin";
import { createSession, LOCK_MINUTES, MAX_ATTEMPTS } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Used so a missing user takes as long to check as a real one.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-pin", 10);
const BAD = { ok: false, error: "Wrong PIN, or the account is not available" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// POST /api/auth/login { userId, pin }
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const userId = typeof body.userId === "string" ? body.userId : "";
    const pin = typeof body.pin === "string" ? body.pin : "";
    if (!UUID.test(userId) || !/^\d{4}$/.test(pin)) {
      return NextResponse.json(
        { ok: false, error: "Choose your name and enter your 4-digit PIN" },
        { status: 400 }
      );
    }

    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user || !user.isActive) {
      await verifyPin(pin, DUMMY_HASH);
      return NextResponse.json(BAD, { status: 401 });
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const mins = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000);
      return NextResponse.json(
        { ok: false, error: `Too many wrong attempts. Try again in ${mins} minute(s), or ask an admin.` },
        { status: 423 }
      );
    }

    const good = await verifyPin(pin, user.pinHash);
    if (!good) {
      const attempts = user.failedAttempts + 1;
      const lock = attempts >= MAX_ATTEMPTS;
      await db
        .update(users)
        .set({
          failedAttempts: lock ? 0 : attempts,
          lockedUntil: lock ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null,
          updatedAt: new Date(),
        })
        .where(eq(users.id, user.id));
      return NextResponse.json(BAD, { status: 401 });
    }

    await db
      .update(users)
      .set({ failedAttempts: 0, lockedUntil: null, updatedAt: new Date() })
      .where(eq(users.id, user.id));
    await createSession(user.id);

    return NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        displayName: user.displayName,
        position: user.position,
        role: user.role,
        mustChangePin: user.mustChangePin,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
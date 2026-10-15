import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { sessions, users } from "@/db/schema";
import { hashPin, pinProblem, verifyPin } from "@/lib/pin";
import { createSession, getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

// POST /api/auth/change-pin { currentPin, newPin }
export async function POST(req: Request) {
  try {
    const me = await getCurrentUser();
    if (!me) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const currentPin = typeof body.currentPin === "string" ? body.currentPin : "";
    const newPin = typeof body.newPin === "string" ? body.newPin : "";

    const problem = pinProblem(newPin);
    if (problem) return NextResponse.json({ ok: false, error: problem }, { status: 400 });
    if (newPin === currentPin) {
      return NextResponse.json({ ok: false, error: "The new PIN must be different" }, { status: 400 });
    }

    const [row] = await db
      .select({ pinHash: users.pinHash })
      .from(users)
      .where(eq(users.id, me.id))
      .limit(1);
    if (!row || !(await verifyPin(currentPin, row.pinHash))) {
      return NextResponse.json({ ok: false, error: "Your current PIN is wrong" }, { status: 401 });
    }

    await db
      .update(users)
      .set({
        pinHash: await hashPin(newPin),
        mustChangePin: false,
        failedAttempts: 0,
        lockedUntil: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, me.id));

    // Sign out every other device, then start a fresh session here.
    await db.delete(sessions).where(eq(sessions.userId, me.id));
    await createSession(me.id);

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
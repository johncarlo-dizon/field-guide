import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { sessions, users } from "@/db/schema";
import { requireAdmin } from "@/lib/admin";
import { hashPin, randomPin } from "@/lib/pin";
import { cleanText, UUID } from "@/lib/error-input";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

function fail(e: unknown) {
  return NextResponse.json(
    { ok: false, error: e instanceof Error ? e.message : "Unknown error" },
    { status: 500 }
  );
}
const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

// PATCH /api/admin/users/:id { action: "reset-pin" | "unlock" | "deactivate" | "activate"
//                             | "make-admin" | "make-user" | "update", displayName?, position? }
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const a = await requireAdmin();
    if ("error" in a) return a.error;

    const { id } = await params;
    if (!UUID.test(id)) return bad("User not found", 404);
    const [u] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!u) return bad("User not found", 404);

    const body = await req.json().catch(() => ({}));
    const action = typeof body.action === "string" ? body.action : "";
    const self = u.id === a.me.id;
    const now = new Date();

    switch (action) {
      case "reset-pin": {
        const tempPin = randomPin();
        await db
          .update(users)
          .set({ pinHash: await hashPin(tempPin), mustChangePin: true, failedAttempts: 0, lockedUntil: null, updatedAt: now })
          .where(eq(users.id, id));
        await db.delete(sessions).where(eq(sessions.userId, id));
        return NextResponse.json({ ok: true, tempPin });
      }
      case "unlock": {
        await db.update(users).set({ failedAttempts: 0, lockedUntil: null, updatedAt: now }).where(eq(users.id, id));
        return NextResponse.json({ ok: true });
      }
      case "deactivate": {
        if (self) return bad("You cannot deactivate your own account");
        await db.update(users).set({ isActive: false, updatedAt: now }).where(eq(users.id, id));
        await db.delete(sessions).where(eq(sessions.userId, id));
        return NextResponse.json({ ok: true });
      }
      case "activate": {
        await db.update(users).set({ isActive: true, updatedAt: now }).where(eq(users.id, id));
        return NextResponse.json({ ok: true });
      }
      case "make-admin":
      case "make-user": {
        if (self) return bad("You cannot change your own role");
        await db
          .update(users)
          .set({ role: action === "make-admin" ? "admin" : "user", updatedAt: now })
          .where(eq(users.id, id));
        return NextResponse.json({ ok: true });
      }
      case "update": {
        const displayName = cleanText(body.displayName, 100);
        const position = cleanText(body.position, 100);
        if (!displayName || !position) return bad("Name and position are required");
        await db.update(users).set({ displayName, position, updatedAt: now }).where(eq(users.id, id));
        return NextResponse.json({ ok: true });
      }
      default:
        return bad("Unknown action");
    }
  } catch (e) {
    return fail(e);
  }
}
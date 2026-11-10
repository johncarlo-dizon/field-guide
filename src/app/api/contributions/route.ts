import { NextResponse } from "next/server";
import { and, gte, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { equipment, errors, procedures, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const RANGES = ["month", "90", "year", "all"] as const;
type Range = (typeof RANGES)[number];

function startOf(range: Range): Date | null {
  const now = new Date();
  if (range === "month") return new Date(now.getFullYear(), now.getMonth(), 1);
  if (range === "90") return new Date(now.getTime() - 90 * 86_400_000);
  if (range === "year") return new Date(now.getFullYear(), 0, 1);
  return null;
}

// GET /api/contributions?range=month|90|year|all
// How many errors, procedures and equipment items each person added in the period.
export async function GET(req: Request) {
  try {
    const me = await getCurrentUser();
    if (!me) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });

    const asked = new URL(req.url).searchParams.get("range") ?? "all";
    const range: Range = (RANGES as readonly string[]).includes(asked) ? (asked as Range) : "all";
    const since = startOf(range);

    const errRows = await db
      .select({
        id: errors.authorId,
        n: sql<number>`count(*)::int`,
        verified: sql<number>`(count(*) filter (where ${errors.status} = 'verified'))::int`,
      })
      .from(errors)
      .where(and(isNull(errors.deletedAt), since ? gte(errors.createdAt, since) : undefined))
      .groupBy(errors.authorId);

    const procRows = await db
      .select({ id: procedures.authorId, n: sql<number>`count(*)::int` })
      .from(procedures)
      .where(and(isNull(procedures.deletedAt), since ? gte(procedures.createdAt, since) : undefined))
      .groupBy(procedures.authorId);

    const eqRows = await db
      .select({ id: equipment.authorId, n: sql<number>`count(*)::int` })
      .from(equipment)
      .where(and(isNull(equipment.deletedAt), since ? gte(equipment.createdAt, since) : undefined))
      .groupBy(equipment.authorId);

    const people = await db
      .select({ id: users.id, name: users.displayName, position: users.position, active: users.isActive })
      .from(users);

    const errMap = new Map(errRows.map((r) => [r.id, r] as const));
    const procMap = new Map(procRows.map((r) => [r.id, r.n] as const));
    const eqMap = new Map(eqRows.map((r) => [r.id, r.n] as const));

    const rows = people
      .map((u) => {
        const er = errMap.get(u.id);
        const errorsN = er?.n ?? 0;
        const proceduresN = procMap.get(u.id) ?? 0;
        const equipmentN = eqMap.get(u.id) ?? 0;
        return {
          userId: u.id,
          name: u.name,
          position: u.position,
          active: u.active,
          errors: errorsN,
          procedures: proceduresN,
          equipment: equipmentN,
          verified: er?.verified ?? 0,
          total: errorsN + proceduresN + equipmentN,
          isMe: u.id === me.id,
        };
      })
      .filter((r) => r.total > 0)
      .sort((a, b) => b.total - a.total || b.verified - a.verified || a.name.localeCompare(b.name));

    const team = rows.reduce(
      (t, r) => ({
        errors: t.errors + r.errors,
        procedures: t.procedures + r.procedures,
        equipment: t.equipment + r.equipment,
        total: t.total + r.total,
      }),
      { errors: 0, procedures: 0, equipment: 0, total: 0 }
    );

    return NextResponse.json({ ok: true, range, since: since ? since.toISOString() : null, rows, team });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
import { NextResponse } from "next/server";
import { and, asc, desc, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { equipment, equipmentBlocks, equipmentParts, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { cleanText, cleanTitle } from "@/lib/error-input";
import { parseParts } from "@/lib/equipment-input";
import { insertParts } from "@/lib/equipment-db";

export const dynamic = "force-dynamic";

function fail(e: unknown) {
  return NextResponse.json(
    { ok: false, error: e instanceof Error ? e.message : "Unknown error" },
    { status: 500 }
  );
}

// GET /api/equipment?q=words&category=Cables
// -> the list, each item with a cover picture, plus all categories in use
export async function GET(req: Request) {
  try {
    const me = await getCurrentUser();
    if (!me) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });

    const url = new URL(req.url);
    const q = url.searchParams.get("q")?.trim() ?? "";
    const category = url.searchParams.get("category")?.trim() ?? "";
    const like = `%${q.replace(/[\\%_]/g, "\\$&")}%`;

    const conds = [isNull(equipment.deletedAt)];
    if (category) conds.push(eq(equipment.category, category));
    if (q) {
      conds.push(
        or(
          ilike(equipment.name, like),
          ilike(equipment.category, like),
          ilike(equipment.modelNumber, like),
          ilike(equipment.summary, like)
        )!
      );
    }

    const rows = await db
      .select({
        id: equipment.id,
        name: equipment.name,
        category: equipment.category,
        modelNumber: equipment.modelNumber,
        summary: equipment.summary,
        updatedAt: equipment.updatedAt,
        authorName: users.displayName,
        authorPosition: users.position,
        partCount: sql<number>`(select count(*)::int from ${equipmentParts} p where p.equipment_id = ${equipment.id})`,
      })
      .from(equipment)
      .innerJoin(users, eq(equipment.authorId, users.id))
      .where(and(...conds))
      .orderBy(asc(equipment.name))
      .limit(200);

    // The first picture of each item is its cover.
    const ids = rows.map((r) => r.id);
    const pics = ids.length
      ? await db
          .select({ equipmentId: equipmentParts.equipmentId, attachmentId: equipmentBlocks.attachmentId })
          .from(equipmentBlocks)
          .innerJoin(equipmentParts, eq(equipmentBlocks.partId, equipmentParts.id))
          .where(and(inArray(equipmentParts.equipmentId, ids), eq(equipmentBlocks.type, "image")))
          .orderBy(asc(equipmentParts.position), asc(equipmentBlocks.position))
      : [];
    const cover = new Map<string, string>();
    for (const p of pics) if (p.attachmentId && !cover.has(p.equipmentId)) cover.set(p.equipmentId, p.attachmentId);

    const cats = await db
      .selectDistinct({ category: equipment.category })
      .from(equipment)
      .where(isNull(equipment.deletedAt))
      .orderBy(asc(equipment.category));

    return NextResponse.json({
      ok: true,
      equipment: rows.map((r) => ({ ...r, coverId: cover.get(r.id) ?? null })),
      categories: cats.map((c) => c.category).filter(Boolean),
    });
  } catch (e) {
    return fail(e);
  }
}

// POST /api/equipment { name, category?, modelNumber?, summary?, parts: [{ title, blocks }] }
export async function POST(req: Request) {
  try {
    const me = await getCurrentUser();
    if (!me) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const name = cleanTitle(body.name);
    if (!name) {
      return NextResponse.json({ ok: false, error: "A name (up to 200 characters) is required" }, { status: 400 });
    }
    const parts = parseParts(body.parts ?? []);
    if (typeof parts === "string") {
      return NextResponse.json({ ok: false, error: parts }, { status: 400 });
    }

    const id = await db.transaction(async (tx) => {
      const [e] = await tx
        .insert(equipment)
        .values({
          name,
          category: cleanText(body.category, 60),
          modelNumber: cleanText(body.modelNumber, 80),
          summary: cleanText(body.summary, 300),
          authorId: me.id,
        })
        .returning({ id: equipment.id });
      await insertParts(tx, e.id, parts);
      return e.id;
    });

    return NextResponse.json({ ok: true, id }, { status: 201 });
  } catch (e) {
    return fail(e);
  }
}
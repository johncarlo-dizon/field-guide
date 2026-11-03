import { NextResponse } from "next/server";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { equipment, equipmentBlocks, equipmentParts, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { cleanText, cleanTitle, UUID } from "@/lib/error-input";
import { parseParts } from "@/lib/equipment-input";
import { insertParts } from "@/lib/equipment-db";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

function fail(e: unknown) {
  return NextResponse.json(
    { ok: false, error: e instanceof Error ? e.message : "Unknown error" },
    { status: 500 }
  );
}
const notFound = () => NextResponse.json({ ok: false, error: "Equipment not found" }, { status: 404 });

async function load(id: string) {
  const [row] = await db
    .select({
      id: equipment.id,
      name: equipment.name,
      category: equipment.category,
      modelNumber: equipment.modelNumber,
      summary: equipment.summary,
      version: equipment.version,
      createdAt: equipment.createdAt,
      updatedAt: equipment.updatedAt,
      authorId: equipment.authorId,
      authorName: users.displayName,
      authorPosition: users.position,
    })
    .from(equipment)
    .innerJoin(users, eq(equipment.authorId, users.id))
    .where(and(eq(equipment.id, id), isNull(equipment.deletedAt)))
    .limit(1);
  return row;
}

// GET /api/equipment/:id -> the item with its parts and blocks, in order
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const me = await getCurrentUser();
    if (!me) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });
    const { id } = await params;
    if (!UUID.test(id)) return notFound();

    const row = await load(id);
    if (!row) return notFound();

    const parts = await db
      .select({ id: equipmentParts.id, position: equipmentParts.position, title: equipmentParts.title })
      .from(equipmentParts)
      .where(eq(equipmentParts.equipmentId, id))
      .orderBy(asc(equipmentParts.position));

    const blocks = parts.length
      ? await db
          .select({
            id: equipmentBlocks.id,
            partId: equipmentBlocks.partId,
            position: equipmentBlocks.position,
            type: equipmentBlocks.type,
            content: equipmentBlocks.content,
            caption: equipmentBlocks.caption,
            attachmentId: equipmentBlocks.attachmentId,
          })
          .from(equipmentBlocks)
          .where(inArray(equipmentBlocks.partId, parts.map((p) => p.id)))
          .orderBy(asc(equipmentBlocks.position))
      : [];

    const result = parts.map((p) => ({ ...p, blocks: blocks.filter((b) => b.partId === p.id) }));
    const canEdit = row.authorId === me.id;
    const canDelete = canEdit || me.role === "admin";
    return NextResponse.json({ ok: true, equipment: { ...row, parts: result, canEdit, canDelete } });
  } catch (e) {
    return fail(e);
  }
}

// PATCH /api/equipment/:id { name?, category?, modelNumber?, summary?, parts? } -> author only
// When parts is sent, it replaces the whole list of parts.
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const me = await getCurrentUser();
    if (!me) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });
    const { id } = await params;
    if (!UUID.test(id)) return notFound();

    const row = await load(id);
    if (!row) return notFound();
    if (row.authorId !== me.id) {
      return NextResponse.json({ ok: false, error: `Only ${row.authorName} can edit this.` }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const patch: Partial<typeof equipment.$inferInsert> = {};

    if (body.name !== undefined) {
      const n = cleanTitle(body.name);
      if (!n) return NextResponse.json({ ok: false, error: "A name is required" }, { status: 400 });
      patch.name = n;
    }
    if (body.category !== undefined) patch.category = cleanText(body.category, 60);
    if (body.modelNumber !== undefined) patch.modelNumber = cleanText(body.modelNumber, 80);
    if (body.summary !== undefined) patch.summary = cleanText(body.summary, 300);

    let parts: ReturnType<typeof parseParts> | undefined;
    if (body.parts !== undefined) {
      parts = parseParts(body.parts);
      if (typeof parts === "string") {
        return NextResponse.json({ ok: false, error: parts }, { status: 400 });
      }
    }

    await db.transaction(async (tx) => {
      await tx
        .update(equipment)
        .set({ ...patch, updatedAt: new Date(), version: sql`${equipment.version} + 1` })
        .where(eq(equipment.id, id));
      if (Array.isArray(parts)) {
        await tx.delete(equipmentParts).where(eq(equipmentParts.equipmentId, id)); // their blocks go too
        await insertParts(tx, id, parts);
      }
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}

// DELETE /api/equipment/:id -> soft delete, author or admin
export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const me = await getCurrentUser();
    if (!me) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });
    const { id } = await params;
    if (!UUID.test(id)) return notFound();

    const row = await load(id);
    if (!row) return notFound();
    if (row.authorId !== me.id && me.role !== "admin") {
      return NextResponse.json({ ok: false, error: `Only ${row.authorName} can delete this.` }, { status: 403 });
    }

    await db.update(equipment).set({ deletedAt: new Date(), updatedAt: new Date() }).where(eq(equipment.id, id));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
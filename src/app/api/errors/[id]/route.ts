import { NextResponse } from "next/server";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { errorBlocks, errors, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { cleanText, cleanTitle, parseBlocks, UUID } from "@/lib/error-input";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const STATUSES = ["draft", "verified", "outdated"] as const;

function fail(e: unknown) {
  return NextResponse.json(
    { ok: false, error: e instanceof Error ? e.message : "Unknown error" },
    { status: 500 }
  );
}
const notFound = () => NextResponse.json({ ok: false, error: "Error not found" }, { status: 404 });

async function loadError(id: string) {
  const [row] = await db
    .select({
      id: errors.id,
      title: errors.title,
      errorText: errors.errorText,
      status: errors.status,
      version: errors.version,
      createdAt: errors.createdAt,
      updatedAt: errors.updatedAt,
      authorId: errors.authorId,
      authorName: users.displayName,
      authorPosition: users.position,
    })
    .from(errors)
    .innerJoin(users, eq(errors.authorId, users.id))
    .where(and(eq(errors.id, id), isNull(errors.deletedAt)))
    .limit(1);
  return row;
}

// GET /api/errors/:id -> one error with its blocks in order
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const me = await getCurrentUser();
    if (!me) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });
    const { id } = await params;
    if (!UUID.test(id)) return notFound();

    const row = await loadError(id);
    if (!row) return notFound();

    const blocks = await db
      .select({
        id: errorBlocks.id,
        position: errorBlocks.position,
        type: errorBlocks.type,
        content: errorBlocks.content,
        caption: errorBlocks.caption,
        attachmentId: errorBlocks.attachmentId,
      })
      .from(errorBlocks)
      .where(eq(errorBlocks.errorId, id))
      .orderBy(asc(errorBlocks.position));

  const canEdit = row.authorId === me.id;
  const canDelete = canEdit || me.role === "admin";
  return NextResponse.json({ ok: true, error: { ...row, blocks, canEdit, canDelete } });
  } catch (e) {
    return fail(e);
  }
}

// PATCH /api/errors/:id { title?, errorText?, status?, blocks? } -> author or admin only
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const me = await getCurrentUser();
    if (!me) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });
    const { id } = await params;
    if (!UUID.test(id)) return notFound();

    const row = await loadError(id);
    if (!row) return notFound();
   if (row.authorId !== me.id) {
    return NextResponse.json(
      { ok: false, error: `Only ${row.authorName} can edit this entry.` },
      { status: 403 }
    );
  }

    const body = await req.json().catch(() => ({}));
    const patch: Partial<typeof errors.$inferInsert> = {};

    if (body.title !== undefined) {
      const t = cleanTitle(body.title);
      if (!t) return NextResponse.json({ ok: false, error: "Title is required (up to 200 characters)" }, { status: 400 });
      patch.title = t;
    }
    if (body.errorText !== undefined) patch.errorText = cleanText(body.errorText, 500);
    if (body.status !== undefined) {
      if (!STATUSES.includes(body.status)) {
        return NextResponse.json({ ok: false, error: "Invalid status" }, { status: 400 });
      }
      patch.status = body.status;
    }

    let blocks: ReturnType<typeof parseBlocks> | undefined;
    if (body.blocks !== undefined) {
      blocks = parseBlocks(body.blocks);
      if (typeof blocks === "string") {
        return NextResponse.json({ ok: false, error: blocks }, { status: 400 });
      }
    }

    await db.transaction(async (tx) => {
      await tx
        .update(errors)
        .set({ ...patch, updatedAt: new Date(), version: sql`${errors.version} + 1` })
        .where(eq(errors.id, id));
      if (Array.isArray(blocks)) {
        await tx.delete(errorBlocks).where(eq(errorBlocks.errorId, id));
        if (blocks.length) {
          await tx.insert(errorBlocks).values(blocks.map((b, i) => ({ errorId: id, position: i, ...b })));
        }
      }
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}

// DELETE /api/errors/:id -> soft delete, author or admin only
export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const me = await getCurrentUser();
    if (!me) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });
    const { id } = await params;
    if (!UUID.test(id)) return notFound();

    const row = await loadError(id);
    if (!row) return notFound();
    if (row.authorId !== me.id && me.role !== "admin") {
      return NextResponse.json(
        { ok: false, error: `Only ${row.authorName} or an admin can delete this.` },
        { status: 403 }
      );
    }

    await db.update(errors).set({ deletedAt: new Date(), updatedAt: new Date() }).where(eq(errors.id, id));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
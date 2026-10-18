import { NextResponse } from "next/server";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { procedures, processBlocks, processes, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { cleanTitle, UUID } from "@/lib/error-input";
import { parseProcesses } from "@/lib/procedure-input";
import { insertProcesses } from "@/lib/procedure-db";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

function fail(e: unknown) {
  return NextResponse.json(
    { ok: false, error: e instanceof Error ? e.message : "Unknown error" },
    { status: 500 }
  );
}
const notFound = () => NextResponse.json({ ok: false, error: "Procedure not found" }, { status: 404 });

async function loadProcedure(id: string) {
  const [row] = await db
    .select({
      id: procedures.id,
      title: procedures.title,
      version: procedures.version,
      createdAt: procedures.createdAt,
      updatedAt: procedures.updatedAt,
      authorId: procedures.authorId,
      authorName: users.displayName,
      authorPosition: users.position,
    })
    .from(procedures)
    .innerJoin(users, eq(procedures.authorId, users.id))
    .where(and(eq(procedures.id, id), isNull(procedures.deletedAt)))
    .limit(1);
  return row;
}

// GET /api/procedures/:id -> the procedure with its processes and blocks, in order
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const me = await getCurrentUser();
    if (!me) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });
    const { id } = await params;
    if (!UUID.test(id)) return notFound();

    const row = await loadProcedure(id);
    if (!row) return notFound();

    const procs = await db
      .select({ id: processes.id, position: processes.position, title: processes.title })
      .from(processes)
      .where(eq(processes.procedureId, id))
      .orderBy(asc(processes.position));

    const blocks = procs.length
      ? await db
          .select({
            id: processBlocks.id,
            processId: processBlocks.processId,
            position: processBlocks.position,
            type: processBlocks.type,
            content: processBlocks.content,
            caption: processBlocks.caption,
            attachmentId: processBlocks.attachmentId,
          })
          .from(processBlocks)
          .where(inArray(processBlocks.processId, procs.map((p) => p.id)))
          .orderBy(asc(processBlocks.position))
      : [];

    const result = procs.map((p) => ({ ...p, blocks: blocks.filter((b) => b.processId === p.id) }));

    const canEdit = row.authorId === me.id;
    const canDelete = canEdit || me.role === "admin";
    return NextResponse.json({ ok: true, procedure: { ...row, processes: result, canEdit, canDelete } });
  } catch (e) {
    return fail(e);
  }
}

// PATCH /api/procedures/:id { title?, processes? } -> author only
// When processes is sent, it replaces the whole list of processes.
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const me = await getCurrentUser();
    if (!me) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });
    const { id } = await params;
    if (!UUID.test(id)) return notFound();

    const row = await loadProcedure(id);
    if (!row) return notFound();
    if (row.authorId !== me.id) {
      return NextResponse.json(
        { ok: false, error: `Only ${row.authorName} can edit this procedure.` },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));

    let title: string | undefined;
    if (body.title !== undefined) {
      const t = cleanTitle(body.title);
      if (!t) return NextResponse.json({ ok: false, error: "Title is required (up to 200 characters)" }, { status: 400 });
      title = t;
    }

    let list: ReturnType<typeof parseProcesses> | undefined;
    if (body.processes !== undefined) {
      list = parseProcesses(body.processes);
      if (typeof list === "string") {
        return NextResponse.json({ ok: false, error: list }, { status: 400 });
      }
    }

    await db.transaction(async (tx) => {
      await tx
        .update(procedures)
        .set({ ...(title ? { title } : {}), updatedAt: new Date(), version: sql`${procedures.version} + 1` })
        .where(eq(procedures.id, id));
      if (Array.isArray(list)) {
        await tx.delete(processes).where(eq(processes.procedureId, id)); // their blocks go too
        await insertProcesses(tx, id, list);
      }
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}

// DELETE /api/procedures/:id -> soft delete, author or admin
export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const me = await getCurrentUser();
    if (!me) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });
    const { id } = await params;
    if (!UUID.test(id)) return notFound();

    const row = await loadProcedure(id);
    if (!row) return notFound();
    if (row.authorId !== me.id && me.role !== "admin") {
      return NextResponse.json(
        { ok: false, error: `Only ${row.authorName} can delete this procedure.` },
        { status: 403 }
      );
    }

    await db
      .update(procedures)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(procedures.id, id));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
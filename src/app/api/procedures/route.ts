import { NextResponse } from "next/server";
import { and, desc, eq, ilike, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { procedures, processes, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { cleanTitle } from "@/lib/error-input";
import { parseProcesses } from "@/lib/procedure-input";
import { insertProcesses } from "@/lib/procedure-db";

export const dynamic = "force-dynamic";

function fail(e: unknown) {
  return NextResponse.json(
    { ok: false, error: e instanceof Error ? e.message : "Unknown error" },
    { status: 500 }
  );
}

// GET /api/procedures?q=text -> list, with the author and how many processes each has
export async function GET(req: Request) {
  try {
    const me = await getCurrentUser();
    if (!me) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });

    const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
    const like = `%${q.replace(/[\\%_]/g, "\\$&")}%`;
    const where = q
      ? and(isNull(procedures.deletedAt), ilike(procedures.title, like))
      : isNull(procedures.deletedAt);

    const rows = await db
      .select({
        id: procedures.id,
        title: procedures.title,
        updatedAt: procedures.updatedAt,
        authorId: procedures.authorId,
        authorName: users.displayName,
        authorPosition: users.position,
        processCount: sql<number>`(select count(*)::int from ${processes} p where p.procedure_id = ${procedures.id})`,
      })
      .from(procedures)
      .innerJoin(users, eq(procedures.authorId, users.id))
      .where(where)
      .orderBy(desc(procedures.updatedAt))
      .limit(100);

    return NextResponse.json({ ok: true, procedures: rows });
  } catch (e) {
    return fail(e);
  }
}

// POST /api/procedures { title, processes: [{ title, blocks: [...] }] }
export async function POST(req: Request) {
  try {
    const me = await getCurrentUser();
    if (!me) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const title = cleanTitle(body.title);
    if (!title) {
      return NextResponse.json({ ok: false, error: "A title (up to 200 characters) is required" }, { status: 400 });
    }
    const list = parseProcesses(body.processes ?? []);
    if (typeof list === "string") {
      return NextResponse.json({ ok: false, error: list }, { status: 400 });
    }

    const id = await db.transaction(async (tx) => {
      const [p] = await tx
        .insert(procedures)
        .values({ title, authorId: me.id })
        .returning({ id: procedures.id });
      await insertProcesses(tx, p.id, list);
      return p.id;
    });

    return NextResponse.json({ ok: true, id }, { status: 201 });
  } catch (e) {
    return fail(e);
  }
}
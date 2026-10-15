import { NextResponse } from "next/server";
import { and, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { attachments, errorBlocks, errors, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { cleanText, cleanTitle, parseBlocks } from "@/lib/error-input";

export const dynamic = "force-dynamic";

function fail(e: unknown) {
  return NextResponse.json(
    { ok: false, error: e instanceof Error ? e.message : "Unknown error" },
    { status: 500 }
  );
}

// GET /api/errors?q=words -> list (newest first). Every word must match somewhere:
// title, message, text steps, captions, or text found inside pictures.
export async function GET(req: Request) {
  try {
    const me = await getCurrentUser();
    if (!me) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });

    const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
    const terms = q.split(/\s+/).filter(Boolean).slice(0, 6);
    const likeOf = (t: string) => `%${t.replace(/[\\%_]/g, "\\$&")}%`;

    const inBlocks = (like: string) =>
      sql`exists (select 1 from ${errorBlocks} b where b.error_id = ${errors.id} and (b.content ilike ${like} or b.caption ilike ${like}))`;
    const ocrHit = (like: string) =>
      sql`exists (select 1 from ${errorBlocks} b join ${attachments} a on a.id = b.attachment_id where b.error_id = ${errors.id} and a.ocr_text ilike ${like})`;

    const perTerm = terms.map((t) => {
      const like = likeOf(t);
      return or(ilike(errors.title, like), ilike(errors.errorText, like), inBlocks(like), ocrHit(like));
    });
    const where = and(isNull(errors.deletedAt), ...perTerm);
    const pic = terms.length ? or(...terms.map((t) => ocrHit(likeOf(t)))) : sql`false`;

    const rows = await db
      .select({
        id: errors.id,
        title: errors.title,
        errorText: errors.errorText,
        status: errors.status,
        createdAt: errors.createdAt,
        updatedAt: errors.updatedAt,
        authorId: errors.authorId,
        authorName: users.displayName,
        authorPosition: users.position,
        inPicture: sql<boolean>`coalesce(${pic}, false)`,
      })
      .from(errors)
      .innerJoin(users, eq(errors.authorId, users.id))
      .where(where)
      .orderBy(desc(errors.updatedAt))
      .limit(100);

    return NextResponse.json({ ok: true, errors: rows });
  } catch (e) {
    return fail(e);
  }
}

// POST /api/errors { title, errorText, blocks: [{ type, content }] }
export async function POST(req: Request) {
  try {
    const me = await getCurrentUser();
    if (!me) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const title = cleanTitle(body.title);
    if (!title) {
      return NextResponse.json({ ok: false, error: "A title (up to 200 characters) is required" }, { status: 400 });
    }
    const blocks = parseBlocks(body.blocks ?? []);
    if (typeof blocks === "string") {
      return NextResponse.json({ ok: false, error: blocks }, { status: 400 });
    }

    const id = await db.transaction(async (tx) => {
      const [e] = await tx
        .insert(errors)
        .values({ title, errorText: cleanText(body.errorText, 500), authorId: me.id })
        .returning({ id: errors.id });
      if (blocks.length) {
        await tx.insert(errorBlocks).values(blocks.map((b, i) => ({ errorId: e.id, position: i, ...b })));
      }
      return e.id;
    });

    return NextResponse.json({ ok: true, id }, { status: 201 });
  } catch (e) {
    return fail(e);
  }
}
import { NextResponse } from "next/server";
import { desc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { errorBlocks, errors, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { cleanText, cleanTitle, parseBlocks } from "@/lib/error-input";
import { errorIndex } from "@/lib/search-errors";
import { tokens } from "@/lib/search";

export const dynamic = "force-dynamic";

function fail(e: unknown) {
  return NextResponse.json(
    { ok: false, error: e instanceof Error ? e.message : "Unknown error" },
    { status: 500 }
  );
}

// GET /api/errors?q=words
// No words: newest first. With words: closest matches first, each with a match percentage.
export async function GET(req: Request) {
  try {
    const me = await getCurrentUser();
    if (!me) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });

    const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";

    const rows = await db
      .select({
        id: errors.id,
        title: errors.title,
        status: errors.status,
        createdAt: errors.createdAt,
        updatedAt: errors.updatedAt,
        authorId: errors.authorId,
        authorName: users.displayName,
        authorPosition: users.position,
      })
      .from(errors)
      .innerJoin(users, eq(errors.authorId, users.id))
      .where(isNull(errors.deletedAt))
      .orderBy(desc(errors.updatedAt));

    const plain = (r: (typeof rows)[number]) => ({ ...r, inPicture: false, score: null, where: null });

    if (!q) return NextResponse.json({ ok: true, errors: rows.slice(0, 100).map(plain) });

    // A search with no real words (only symbols or very common words): simple title match.
    if (tokens(q).length === 0) {
      const s = q.toLowerCase();
      return NextResponse.json({
        ok: true,
        errors: rows.filter((r) => r.title.toLowerCase().includes(s)).slice(0, 100).map(plain),
      });
    }

    const hits = (await errorIndex()).search(q);
    const byId = new Map(rows.map((r) => [r.id, r]));
    const result = hits.flatMap((h) => {
      const r = byId.get(h.owner);
      return r ? [{ ...r, inPicture: h.picture, score: Math.round(h.score * 100), where: h.where }] : [];
    });

    return NextResponse.json({ ok: true, errors: result });
  } catch (e) {
    return fail(e);
  }
}

// POST /api/errors { title, status?, blocks: [{ type, content }] }
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
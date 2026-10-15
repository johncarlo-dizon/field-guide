import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { readFile } from "fs/promises";
import { db } from "@/lib/db";
import { attachments } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { UUID } from "@/lib/error-input";
import { absPath } from "@/lib/uploads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

// GET /api/attachments/:id        -> the full picture
// GET /api/attachments/:id?thumb=1 -> the small version
export async function GET(req: Request, { params }: Ctx) {
  try {
    const me = await getCurrentUser();
    if (!me) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });

    const { id } = await params;
    if (!UUID.test(id)) return NextResponse.json({ ok: false }, { status: 404 });

    const [row] = await db
      .select({ filePath: attachments.filePath, thumbPath: attachments.thumbPath })
      .from(attachments)
      .where(eq(attachments.id, id))
      .limit(1);
    if (!row) return NextResponse.json({ ok: false }, { status: 404 });

    const wantThumb = new URL(req.url).searchParams.get("thumb") === "1" && row.thumbPath;
    const buf = await readFile(absPath(wantThumb ? (row.thumbPath as string) : row.filePath));

    return new NextResponse(new Uint8Array(buf), {
      headers: { "Content-Type": "image/webp", "Cache-Control": "private, max-age=86400" },
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
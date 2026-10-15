import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import sharp from "sharp";
import { db } from "@/lib/db";
import { attachments } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { absPath } from "@/lib/uploads";
import { queueOcr } from "@/lib/ocr";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const OK_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

// POST /api/attachments (form data with a "file") -> { ok, id }
export async function POST(req: Request) {
  try {
    const me = await getCurrentUser();
    if (!me) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });

    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!file || typeof file === "string") {
      return NextResponse.json({ ok: false, error: "No picture received" }, { status: 400 });
    }
    if (!OK_TYPES.has(file.type)) {
      return NextResponse.json({ ok: false, error: "Only PNG, JPG, WEBP or GIF pictures" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ ok: false, error: "The picture is too large (maximum 10 MB)" }, { status: 400 });
    }

    const input = Buffer.from(await file.arrayBuffer());
    const img = sharp(input).rotate(); // respects the phone's photo orientation
    const main = await img
      .clone()
      .resize({ width: 1600, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });
    const thumb = await img
      .clone()
      .resize({ width: 400, withoutEnlargement: true })
      .webp({ quality: 75 })
      .toBuffer();

    const now = new Date();
    const dir = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
    const name = randomUUID();
    const filePath = `${dir}/${name}.webp`;
    const thumbPath = `${dir}/${name}-thumb.webp`;

    await mkdir(absPath(dir), { recursive: true });
    await writeFile(absPath(filePath), main.data);
    await writeFile(absPath(thumbPath), thumb);

    const [row] = await db
      .insert(attachments)
      .values({
        filePath,
        thumbPath,
        width: main.info.width,
        height: main.info.height,
        createdBy: me.id,
      })
      .returning({ id: attachments.id });

          // Read the text inside the picture in the background (does not slow the upload)
    const ocrInput = await img
      .clone()
      .resize({ width: 1600, withoutEnlargement: true })
      .grayscale()
      .normalize()
      .png()
      .toBuffer();
    queueOcr(row.id, ocrInput);
    return NextResponse.json({ ok: true, id: row.id }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
import path from "path";
import { mkdir } from "fs/promises";
import sharp from "sharp";
import { createWorker, PSM } from "tesseract.js";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { attachments } from "@/db/schema";

export type OcrWorker = Awaited<ReturnType<typeof createWorker>>;
export type OcrResult = { text: string; confidence: number; mode: string };

// Results below this confidence are thrown away as unreadable. 0 keeps everything.
const MIN_CONFIDENCE = 0;

export async function createOcrWorker(): Promise<OcrWorker> {
  const cachePath = path.resolve(".tesseract-cache");
  await mkdir(cachePath, { recursive: true });
  return createWorker("eng", 1, { cachePath });
}

// Small screenshots are enlarged first, because OCR cannot read very small text.
export async function prepareForOcr(input: Buffer): Promise<Buffer> {
  const meta = await sharp(input).metadata();
  const w = meta.width ?? 800;
  const target = w >= 1400 ? Math.min(w, 2400) : Math.min(2400, Math.max(1600, w * 4));
  return sharp(input)
    .rotate()
    .resize({ width: target, kernel: "lanczos3" })
    .grayscale()
    .normalize()
    .sharpen()
    .png()
    .toBuffer();
}

// Reads the picture as a normal page, then as scattered text (dialogs, buttons), and keeps the better result.
export async function readText(worker: OcrWorker, image: Buffer): Promise<OcrResult> {
  let best: OcrResult = { text: "", confidence: -1, mode: "" };
  for (const [mode, psm] of [["page", PSM.AUTO], ["scattered", PSM.SPARSE_TEXT]] as const) {
    await worker.setParameters({ tessedit_pageseg_mode: psm });
    const { data } = await worker.recognize(image);
    const text = (data.text ?? "").replace(/\s+/g, " ").trim();
    if (data.confidence > best.confidence) best = { text, confidence: data.confidence, mode };
  }
  return best;
}

// Pictures are read one at a time, so pasting several screenshots does not overload the server.
let chain: Promise<void> = Promise.resolve();

export function queueOcr(attachmentId: string, original: Buffer) {
  chain = chain
    .then(() => run(attachmentId, original))
    .catch((e) => console.error("OCR failed for", attachmentId, e));
}

async function run(id: string, original: Buffer) {
  const worker = await createOcrWorker();
  try {
    const best = await readText(worker, await prepareForOcr(original));
    const keep = best.confidence >= MIN_CONFIDENCE ? best.text.slice(0, 20000) : "";
    await db.update(attachments).set({ ocrText: keep }).where(eq(attachments.id, id));
    console.log(
      `OCR done for ${id}: ${best.text.length} characters, confidence ${Math.round(best.confidence)} (${best.mode}), ` +
        (keep ? "saved" : "discarded as unreadable")
    );
  } finally {
    await worker.terminate();
  }
}
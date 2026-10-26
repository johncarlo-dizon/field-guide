import path from "path";
import { mkdir } from "fs/promises";
import { createWorker, PSM } from "tesseract.js";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { attachments } from "@/db/schema";

// Pictures are read one at a time, so pasting several screenshots does not overload the server.
let chain: Promise<void> = Promise.resolve();

// Results below this confidence are thrown away as unreadable. 0 keeps everything.
// After testing we can raise it, to stop garbage text from being searchable.
const MIN_CONFIDENCE = 0;

export function queueOcr(attachmentId: string, image: Buffer) {
  chain = chain
    .then(() => run(attachmentId, image))
    .catch((e) => console.error("OCR failed for", attachmentId, e));
}

async function run(id: string, image: Buffer) {
  const cachePath = path.resolve(".tesseract-cache");
  await mkdir(cachePath, { recursive: true });

  const worker = await createWorker("eng", 1, { cachePath });
  try {
    // Read it as a normal page, then as scattered text (dialogs, buttons), and keep the better one.
    let best = { text: "", confidence: -1, mode: "" };
    for (const [mode, psm] of [["page", PSM.AUTO], ["scattered", PSM.SPARSE_TEXT]] as const) {
      await worker.setParameters({ tessedit_pageseg_mode: psm });
      const { data } = await worker.recognize(image);
      const text = (data.text ?? "").replace(/\s+/g, " ").trim();
      if (data.confidence > best.confidence) best = { text, confidence: data.confidence, mode };
    }

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
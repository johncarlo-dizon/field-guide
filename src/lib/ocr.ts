import path from "path";
import { mkdir } from "fs/promises";
import { createWorker } from "tesseract.js";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { attachments } from "@/db/schema";

// Pictures are read one at a time, so pasting several screenshots does not overload the server.
let chain: Promise<void> = Promise.resolve();

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
    const { data } = await worker.recognize(image);
    const text = (data.text ?? "").replace(/\s+/g, " ").trim().slice(0, 20000);
    await db.update(attachments).set({ ocrText: text }).where(eq(attachments.id, id));
    console.log(`OCR done for ${id}: ${text.length} characters`);
  } finally {
    await worker.terminate();
  }
}
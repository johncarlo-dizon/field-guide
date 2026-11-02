import "./env";
import { writeFileSync } from "fs";
import { readFile } from "fs/promises";
import { asc, eq } from "drizzle-orm";
import { db, pool } from "../src/lib/db";
import { attachments } from "../src/db/schema";
import { absPath } from "../src/lib/uploads";
import { createOcrWorker, prepareForOcr, readText } from "../src/lib/ocr";

// Usage (from the project folder):
//   npm run reocr -- --dry-run --limit 5   show what would change, save nothing
//   npm run reocr                          re-read every picture
//   npm run reocr -- --only-empty          only pictures with little or no saved text
const args = process.argv.slice(2);
const onlyEmpty = args.includes("--only-empty");
const dry = args.includes("--dry-run");
const li = args.indexOf("--limit");
const limit = li >= 0 ? Number(args[li + 1]) : Infinity;

const MIN_REPLACE = 35; // below this confidence, keep the old text if there is some

const snip = (s: string, n: number) => (s.length > n ? s.slice(0, n) + "..." : s);

async function main() {
  let rows = await db
    .select({ id: attachments.id, filePath: attachments.filePath, ocr: attachments.ocrText })
    .from(attachments)
    .orderBy(asc(attachments.createdAt));

  if (onlyEmpty) rows = rows.filter((r) => r.ocr.trim().length < 12);
  rows = rows.slice(0, limit);

  console.log(`${rows.length} picture(s) to read${dry ? " (dry run: nothing will be saved)" : ""}.`);
  if (rows.length === 0) { await pool.end(); return; }

  if (!dry) {
    const file = `ocr-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    writeFileSync(file, JSON.stringify(Object.fromEntries(rows.map((r) => [r.id, r.ocr])), null, 1));
    console.log(`The old text was saved to ${file}`);
  }

  const worker = await createOcrWorker();
  const started = Date.now();
  let updated = 0;
  let kept = 0;
  let failed = 0;

  try {
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      try {
        const buf = await readFile(absPath(r.filePath));
        const res = await readText(worker, await prepareForOcr(buf));
        const better = res.text.length > 0 && (res.confidence >= MIN_REPLACE || r.ocr.trim().length === 0);

        if (better) {
          if (!dry) await db.update(attachments).set({ ocrText: res.text.slice(0, 20000) }).where(eq(attachments.id, r.id));
          updated++;
        } else {
          kept++;
        }

        const perItem = (Date.now() - started) / (i + 1) / 1000;
        const left = Math.round(perItem * (rows.length - i - 1));
        console.log(
          `[${i + 1}/${rows.length}] ${r.id.slice(0, 8)} confidence ${Math.round(res.confidence)} (${res.mode}) ` +
            `${better ? (dry ? "would update" : "updated") : "kept old"}  about ${left}s left`
        );
        if (dry) {
          console.log(`   old: "${snip(r.ocr, 70)}"`);
          console.log(`   new: "${snip(res.text, 70)}"`);
        }
      } catch (e) {
        failed++;
        console.error(`[${i + 1}/${rows.length}] ${r.id.slice(0, 8)} failed:`, e instanceof Error ? e.message : e);
      }
    }
  } finally {
    await worker.terminate();
    await pool.end();
  }

  console.log(`Done. Updated: ${updated}, kept old: ${kept}, failed: ${failed}.`);
}

main().catch(async (e) => {
  console.error(e);
  await pool.end();
  process.exit(1);
});
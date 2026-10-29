import { asc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { attachments, errorBlocks, errors } from "@/db/schema";
import { parseText } from "@/lib/richtext";
import { SearchIndex, windows, type Chunk } from "@/lib/search";

let cache: { at: number; index: SearchIndex } | null = null;
const TTL = 10_000; // a new or edited entry becomes searchable within about 10 seconds

// Cuts long text into short overlapping stretches, so a focused search scores higher.
function windows(text: string, size = 14, step = 7): string[] {
  const ws = text.split(/\s+/).filter(Boolean);
  if (ws.length === 0) return [];
  if (ws.length <= size) return [ws.join(" ")];
  const out: string[] = [];
  for (let i = 0; i < ws.length; i += step) {
    out.push(ws.slice(i, i + size).join(" "));
    if (i + size >= ws.length) break;
  }
  return out;
}

export async function errorIndex(): Promise<SearchIndex> {
  if (cache && Date.now() - cache.at < TTL) return cache.index;

  const rows = await db
    .select({ id: errors.id, title: errors.title })
    .from(errors)
    .where(isNull(errors.deletedAt));

  const blocks = await db
    .select({
      errorId: errorBlocks.errorId,
      type: errorBlocks.type,
      content: errorBlocks.content,
      caption: errorBlocks.caption,
      ocr: attachments.ocrText,
    })
    .from(errorBlocks)
    .innerJoin(errors, eq(errorBlocks.errorId, errors.id))
    .leftJoin(attachments, eq(errorBlocks.attachmentId, attachments.id))
    .where(isNull(errors.deletedAt))
    .orderBy(asc(errorBlocks.position));

  const chunks: Chunk[] = [];
  for (const r of rows) chunks.push({ owner: r.id, where: "title", text: r.title });

  for (const b of blocks) {
    if (b.type === "text") {
      for (const p of parseText(b.content)) {
        const text = p.kind === "p" ? p.lines.join(" ") : p.items.map((i) => i.text).join(" ");
        for (const w of windows(text)) chunks.push({ owner: b.errorId, where: "steps", text: w });
      }
    } else {
      if (b.caption) chunks.push({ owner: b.errorId, where: "steps", text: b.caption });
      for (const w of windows(b.ocr ?? "")) chunks.push({ owner: b.errorId, where: "picture", text: w });
    }
  }

  const index = new SearchIndex(chunks);
  cache = { at: Date.now(), index };
  return index;
}
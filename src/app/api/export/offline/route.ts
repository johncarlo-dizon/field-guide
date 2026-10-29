import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { asc, desc, eq, inArray, isNull } from "drizzle-orm";
import sharp from "sharp";
import { db } from "@/lib/db";
import {
  attachments, errorBlocks, errors, procedures, processBlocks, processes, users,
} from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { absPath } from "@/lib/uploads";
import { parseText } from "@/lib/richtext";
import { windows } from "@/lib/search";
import { esc, pageHtml, richToHtml, safeJson } from "@/lib/export-html";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Blk = {
  type: "text" | "image";
  content: string;
  caption: string;
  attachmentId: string | null;
  ocr: string | null;
  filePath: string | null;
};

const BUDGET = 80_000_000; // stop adding pictures after about 80 MB, so the file stays usable

async function dataUri(filePath: string): Promise<string | null> {
  try {
    const buf = await readFile(absPath(filePath));
    const out = await sharp(buf).resize({ width: 900, withoutEnlargement: true }).webp({ quality: 70 }).toBuffer();
    return "data:image/webp;base64," + out.toString("base64");
  } catch {
    return null;
  }
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const day = (d: Date) => d.toISOString().slice(0, 10);

function blocksHtml(bs: Blk[], uris: Map<string, string | null>): string {
  return bs
    .map((b) => {
      if (b.type === "text") return `<div class="rt">${richToHtml(b.content)}</div>`;
      const uri = b.attachmentId ? uris.get(b.attachmentId) : null;
      const caption = b.caption ? `<figcaption>${esc(b.caption)}</figcaption>` : "";
      return uri
        ? `<figure><img src="${uri}" alt="${esc(b.caption || "Screenshot")}">${caption}</figure>`
        : `<figure class="nopic">[picture not included]${caption}</figure>`;
    })
    .join("");
}

const rowHtml = (title: string) =>
  `<span class="row"><b>${esc(title)}</b><span class="pct" style="display:none"></span></span>`;

// GET /api/export/offline          -> one file with everything, pictures included
// GET /api/export/offline?images=0 -> text only (much smaller)
export async function GET(req: Request) {
  try {
    const me = await getCurrentUser();
    if (!me) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });
    const withImages = new URL(req.url).searchParams.get("images") !== "0";

    /* ---------- errors ---------- */
    const errs = await db
      .select({
        id: errors.id, title: errors.title, status: errors.status, updatedAt: errors.updatedAt,
        authorName: users.displayName, authorPosition: users.position,
      })
      .from(errors)
      .innerJoin(users, eq(errors.authorId, users.id))
      .where(isNull(errors.deletedAt))
      .orderBy(desc(errors.updatedAt));

    const eRows = errs.length
      ? await db
          .select({
            parent: errorBlocks.errorId, type: errorBlocks.type, content: errorBlocks.content,
            caption: errorBlocks.caption, attachmentId: errorBlocks.attachmentId,
            ocr: attachments.ocrText, filePath: attachments.filePath,
          })
          .from(errorBlocks)
          .leftJoin(attachments, eq(errorBlocks.attachmentId, attachments.id))
          .where(inArray(errorBlocks.errorId, errs.map((e) => e.id)))
          .orderBy(asc(errorBlocks.position))
      : [];

    /* ---------- procedures ---------- */
    const procs = await db
      .select({
        id: procedures.id, title: procedures.title, updatedAt: procedures.updatedAt,
        authorName: users.displayName, authorPosition: users.position,
      })
      .from(procedures)
      .innerJoin(users, eq(procedures.authorId, users.id))
      .where(isNull(procedures.deletedAt))
      .orderBy(desc(procedures.updatedAt));

    const pRows = procs.length
      ? await db
          .select({ id: processes.id, procedureId: processes.procedureId, title: processes.title })
          .from(processes)
          .where(inArray(processes.procedureId, procs.map((p) => p.id)))
          .orderBy(asc(processes.position))
      : [];

    const bRows = pRows.length
      ? await db
          .select({
            parent: processBlocks.processId, type: processBlocks.type, content: processBlocks.content,
            caption: processBlocks.caption, attachmentId: processBlocks.attachmentId,
            ocr: attachments.ocrText, filePath: attachments.filePath,
          })
          .from(processBlocks)
          .leftJoin(attachments, eq(processBlocks.attachmentId, attachments.id))
          .where(inArray(processBlocks.processId, pRows.map((p) => p.id)))
          .orderBy(asc(processBlocks.position))
      : [];

    const group = (rows: typeof eRows) => {
      const m = new Map<string, Blk[]>();
      for (const r of rows) {
        const arr = m.get(r.parent) ?? [];
        arr.push({
          type: r.type, content: r.content, caption: r.caption,
          attachmentId: r.attachmentId, ocr: r.ocr, filePath: r.filePath,
        });
        m.set(r.parent, arr);
      }
      return m;
    };
    const eMap = group(eRows);
    const bMap = group(bRows);

    /* ---------- pictures (smaller copies inside the file) ---------- */
    const wanted = new Map<string, string>();
    for (const m of [eMap, bMap]) {
      for (const arr of m.values()) {
        for (const b of arr) if (b.attachmentId && b.filePath) wanted.set(b.attachmentId, b.filePath);
      }
    }
    const uris = new Map<string, string | null>();
    if (withImages) {
      let total = 0;
      const list = [...wanted.entries()];
      for (let i = 0; i < list.length; i += 4) {
        const chunk = list.slice(i, i + 4);
        const done = await Promise.all(chunk.map(([, p]) => dataUri(p)));
        chunk.forEach(([id], k) => {
          const u = done[k];
          if (u && total + u.length <= BUDGET) { total += u.length; uris.set(id, u); }
          else uris.set(id, null);
        });
      }
    }

    /* ---------- search pieces: [entry number, where (0 title, 1 steps, 2 picture), text] ---------- */
    const chunks: [number, number, string][] = [];
    const addPieces = (owner: number, bs: Blk[]) => {
      for (const b of bs) {
        if (b.type === "text") {
          for (const p of parseText(b.content)) {
            const text = p.kind === "p" ? p.lines.join(" ") : p.items.map((i) => i.text).join(" ");
            for (const w of windows(text)) chunks.push([owner, 1, w]);
          }
        } else {
          if (b.caption) chunks.push([owner, 1, b.caption]);
          for (const w of windows(b.ocr ?? "")) chunks.push([owner, 2, w]);
        }
      }
    };

    /* ---------- build the page ---------- */
    const errorsHtml = errs
      .map((e, idx) => {
        const bs = eMap.get(e.id) ?? [];
        chunks.push([idx, 0, e.title]);
        addPieces(idx, bs);
        return (
          `<details class="entry" data-kind="errors" data-i="${idx}">` +
          `<summary>${rowHtml(e.title)}<span class="meta">${esc(cap(e.status))} · ${esc(e.authorName)} (${esc(e.authorPosition)}) · ${day(e.updatedAt)}</span>` +
          `<span class="where" style="display:none"></span></summary>` +
          `<div class="body">${blocksHtml(bs, uris)}</div></details>`
        );
      })
      .join("");

    const procsHtml = procs
      .map((p, j) => {
        const idx = errs.length + j;
        const mine = pRows.filter((r) => r.procedureId === p.id);
        chunks.push([idx, 0, p.title]);
        for (const r of mine) {
          chunks.push([idx, 0, r.title]);
          addPieces(idx, bMap.get(r.id) ?? []);
        }
        const inner = mine
          .map(
            (r, i) =>
              `<details class="proc"><summary><b>${i + 1}. ${esc(r.title)}</b></summary>` +
              `<div class="body">${blocksHtml(bMap.get(r.id) ?? [], uris)}</div></details>`
          )
          .join("");
        return (
          `<details class="entry" data-kind="procedures" data-i="${idx}">` +
          `<summary>${rowHtml(p.title)}<span class="meta">${mine.length} ${mine.length === 1 ? "process" : "processes"} · ${esc(p.authorName)} (${esc(p.authorPosition)}) · ${day(p.updatedAt)}</span>` +
          `<span class="where" style="display:none"></span></summary>` +
          `<div class="body">${inner}</div></details>`
        );
      })
      .join("");

    const date = day(new Date());
    const html = pageHtml({
      date, by: me.displayName,
      errorCount: errs.length, procCount: procs.length,
      errorsHtml, procsHtml,
      dataJson: safeJson({ c: chunks }),
    });

    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `attachment; filename="FieldGuide-offline-${date}.html"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
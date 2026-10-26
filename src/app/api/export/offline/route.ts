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
import { esc, pageHtml, plain, richToHtml } from "@/lib/export-html";

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
const blob = (parts: string[]) => parts.join(" ").replace(/\s+/g, " ").toLowerCase();
const blockText = (bs: Blk[]) =>
  bs.map((b) => (b.type === "text" ? plain(b.content) : `${b.caption} ${b.ocr ?? ""}`));

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

    /* ---------- build the page ---------- */
    const errorsHtml = errs
      .map((e) => {
        const bs = eMap.get(e.id) ?? [];
        const search = blob([e.title, e.status, e.authorName, ...blockText(bs)]);
        return (
          `<details class="entry" data-kind="errors" data-s="${esc(search)}">` +
          `<summary><b>${esc(e.title)}</b><span class="meta">${esc(cap(e.status))} · ${esc(e.authorName)} (${esc(e.authorPosition)}) · ${day(e.updatedAt)}</span></summary>` +
          `<div class="body">${blocksHtml(bs, uris)}</div></details>`
        );
      })
      .join("");

    const procsHtml = procs
      .map((p) => {
        const mine = pRows.filter((r) => r.procedureId === p.id);
        const search = blob([
          p.title, p.authorName,
          ...mine.flatMap((r) => [r.title, ...blockText(bMap.get(r.id) ?? [])]),
        ]);
        const inner = mine
          .map(
            (r, i) =>
              `<details class="proc"><summary><b>${i + 1}. ${esc(r.title)}</b></summary>` +
              `<div class="body">${blocksHtml(bMap.get(r.id) ?? [], uris)}</div></details>`
          )
          .join("");
        return (
          `<details class="entry" data-kind="procedures" data-s="${esc(search)}">` +
          `<summary><b>${esc(p.title)}</b><span class="meta">${mine.length} ${mine.length === 1 ? "process" : "processes"} · ${esc(p.authorName)} (${esc(p.authorPosition)}) · ${day(p.updatedAt)}</span></summary>` +
          `<div class="body">${inner}</div></details>`
        );
      })
      .join("");

    const date = day(new Date());
    const html = pageHtml({
      date, by: me.displayName,
      errorCount: errs.length, procCount: procs.length,
      errorsHtml, procsHtml,
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
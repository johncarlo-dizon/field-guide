import { cleanTitle, parseBlocks, type BlockInput } from "@/lib/error-input";

export type PartInput = { title: string; blocks: BlockInput[] };

// Returns the cleaned parts, or a message describing the problem.
export function parseParts(raw: unknown): PartInput[] | string {
  if (!Array.isArray(raw)) return "parts must be a list";
  if (raw.length > 30) return "Too many parts (maximum 30)";

  const out: PartInput[] = [];
  for (const item of raw) {
    const p = (item ?? {}) as Record<string, unknown>;
    const title = cleanTitle(p.title);
    if (!title) return "Each part needs a name (up to 200 characters)";
    const blocks = parseBlocks(p.blocks ?? []);
    if (typeof blocks === "string") return blocks;
    out.push({ title, blocks });
  }
  return out;
}
import { cleanTitle, parseBlocks, type BlockInput } from "@/lib/error-input";

export type ProcessInput = { title: string; blocks: BlockInput[] };

// Returns the cleaned processes, or a message describing the problem.
export function parseProcesses(raw: unknown): ProcessInput[] | string {
  if (!Array.isArray(raw)) return "processes must be a list";
  if (raw.length > 50) return "Too many processes (maximum 50)";

  const out: ProcessInput[] = [];
  for (const item of raw) {
    const p = (item ?? {}) as Record<string, unknown>;
    const title = cleanTitle(p.title);
    if (!title) return "Each process needs a title (up to 200 characters)";
    const blocks = parseBlocks(p.blocks ?? []);
    if (typeof blocks === "string") return blocks;
    out.push({ title, blocks });
  }
  return out;
}
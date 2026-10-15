export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type BlockInput = {
  type: "text" | "image";
  content: string;
  caption: string;
  attachmentId: string | null;
};

export function cleanTitle(v: unknown): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  return s.length > 0 && s.length <= 200 ? s : null;
}

export function cleanText(v: unknown, max: number): string {
  return (typeof v === "string" ? v.trim() : "").slice(0, max);
}

// Returns the cleaned blocks, or a message describing the problem.
export function parseBlocks(raw: unknown): BlockInput[] | string {
  if (!Array.isArray(raw)) return "blocks must be a list";
  if (raw.length > 50) return "Too many blocks (maximum 50)";
  const out: BlockInput[] = [];
  for (const item of raw) {
    const b = (item ?? {}) as Record<string, unknown>;
    if (b.type === "text") {
      const content = cleanText(b.content, 5000);
      if (content) out.push({ type: "text", content, caption: "", attachmentId: null });
    } else if (b.type === "image") {
      if (typeof b.attachmentId !== "string" || !UUID.test(b.attachmentId)) {
        return "Each picture block needs a valid attachmentId";
      }
      out.push({ type: "image", content: "", caption: cleanText(b.caption, 200), attachmentId: b.attachmentId });
    } else {
      return "Each block must have type text or image";
    }
  }
  return out;
}
// Text blocks are stored as plain text with a few marks:
//   **bold**   ==highlight==   and bullet lines starting with "- " (2 spaces of indent per level).
// The editor and the reading pages both use these helpers.

export type Item = { level: number; text: string };
export type TextBlock = { kind: "p"; lines: string[] } | { kind: "ul"; items: Item[] };
export type Li = { text: string; children: Li[] };
export type PMNode = { type?: string; content?: PMNode[]; text?: string; marks?: { type: string }[] };

type Line = { raw: string; t: "bullet" | "dash" | "blank" | "text"; level: number; text: string };

// Splits text into paragraphs and bullet lists.
// Older entries that used a plain "-text" on two or more lines in a row also become bullets.
export function parseText(input: string): TextBlock[] {
  const lines = input
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((raw): Line => {
      const b = /^( *)- (.*)$/.exec(raw);
      if (b) return { raw, t: "bullet", level: Math.floor(b[1].length / 2), text: b[2] };
      if (raw.trim() === "") return { raw, t: "blank", level: 0, text: "" };
      if (/^-(?![\s-])/.test(raw)) return { raw, t: "dash", level: 0, text: raw.slice(1) };
      return { raw, t: "text", level: 0, text: raw };
    });

  for (let i = 0; i < lines.length; ) {
    if (lines[i].t !== "dash") { i++; continue; }
    let j = i;
    while (j < lines.length && lines[j].t === "dash") j++;
    if (j - i >= 2) for (let k = i; k < j; k++) lines[k].t = "bullet";
    i = j;
  }

  const out: TextBlock[] = [];
  let para: string[] = [];
  let items: Item[] = [];
  const flushPara = () => {
    if (para.length) { out.push({ kind: "p", lines: para }); para = []; }
  };
  const flushList = () => {
    if (items.length) { out.push({ kind: "ul", items }); items = []; }
  };

  for (const l of lines) {
    if (l.t === "bullet") {
      flushPara();
      items.push({ level: l.level, text: l.text });
    } else if (l.t === "blank") {
      flushPara();
      flushList();
    } else {
      flushList();
      para.push(l.raw);
    }
  }
  flushPara();
  flushList();
  return out;
}

// Turns the flat list of bullet lines into nested bullets.
export function itemTree(items: Item[]): Li[] {
  const root: Li[] = [];
  const path: Li[] = [];
  let prev = -1;
  for (const it of items) {
    const level = Math.min(it.level, prev + 1); // a bullet can only go one level deeper than the one above
    const node: Li = { text: it.text, children: [] };
    if (level === 0) root.push(node);
    else path[level - 1].children.push(node);
    path[level] = node;
    path.length = level + 1;
    prev = level;
  }
  return root;
}

/* ---------- text -> editor document ---------- */

function inlineNodes(text: string, marks: string[] = []): PMNode[] {
  const out: PMNode[] = [];
  const re = /\*\*(.+?)\*\*|==(.+?)==/g;
  let last = 0;
  let m: RegExpExecArray | null;
  const push = (t: string) => {
    if (t) out.push({ type: "text", text: t, ...(marks.length ? { marks: marks.map((type) => ({ type })) } : {}) });
  };
  while ((m = re.exec(text)) !== null) {
    push(text.slice(last, m.index));
    if (m[1] !== undefined) out.push(...inlineNodes(m[1], [...marks, "bold"]));
    else out.push(...inlineNodes(m[2], [...marks, "highlight"]));
    last = m.index + m[0].length;
  }
  push(text.slice(last));
  return out;
}

function listNode(nodes: Li[]): PMNode {
  return {
    type: "bulletList",
    content: nodes.map((n) => ({
      type: "listItem",
      content: [
        n.text ? { type: "paragraph", content: inlineNodes(n.text) } : { type: "paragraph" },
        ...(n.children.length ? [listNode(n.children)] : []),
      ],
    })),
  };
}

export function textToDoc(text: string): PMNode {
  const content: PMNode[] = [];
  for (const b of parseText(text)) {
    if (b.kind === "ul") {
      content.push(listNode(itemTree(b.items)));
    } else {
      const nodes: PMNode[] = [];
      b.lines.forEach((line, i) => {
        if (i > 0) nodes.push({ type: "hardBreak" });
        nodes.push(...inlineNodes(line));
      });
      content.push(nodes.length ? { type: "paragraph", content: nodes } : { type: "paragraph" });
    }
  }
  return { type: "doc", content: content.length ? content : [{ type: "paragraph" }] };
}

/* ---------- editor document -> text ---------- */

function inlineText(node: PMNode): string {
  return (node.content ?? [])
    .map((n) => {
      if (n.type === "hardBreak") return "\n";
      if (n.type !== "text") return "";
      let t = n.text ?? "";
      const marks = (n.marks ?? []).map((m) => m.type);
      if (marks.includes("highlight")) t = `==${t}==`;
      if (marks.includes("bold")) t = `**${t}**`;
      return t;
    })
    .join("");
}

function listLines(list: PMNode, level: number): string[] {
  const out: string[] = [];
  for (const li of list.content ?? []) {
    const parts = li.content ?? [];
    const text = parts
      .filter((p) => p.type === "paragraph")
      .map((p) => inlineText(p).replace(/\n/g, " "))
      .join(" ")
      .trim();
    const sub = parts.filter((p) => p.type === "bulletList").flatMap((p) => listLines(p, level + 1));
    if (!text && sub.length === 0) continue;
    out.push(" ".repeat(level * 2) + "- " + text);
    out.push(...sub);
  }
  return out;
}

export function docToText(doc: PMNode): string {
  const blocks: string[] = [];
  for (const n of doc.content ?? []) {
    if (n.type === "paragraph") {
      const t = inlineText(n);
      if (t.trim()) blocks.push(t);
    } else if (n.type === "bulletList") {
      const lines = listLines(n, 0);
      if (lines.length) blocks.push(lines.join("\n"));
    }
  }
  return blocks.join("\n\n");
}
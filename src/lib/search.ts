// Search by cosine similarity (TF-IDF). Pure code, no extra packages.

export type Chunk = { owner: string; where: "title" | "steps" | "picture"; text: string };
export type Hit = { owner: string; score: number; where: Chunk["where"]; picture: boolean };

const STOP = new Set(
  ("a an and are as at be but by for from has have i if in into is it its of on or that the their " +
    "then there these they this to was were will with you your not no do does did can could should would").split(" ")
);

function stem(w: string): string {
  if (w.length > 4 && w.endsWith("ing")) return w.slice(0, -3);
  if (w.length > 4 && w.endsWith("ed")) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith("es")) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
  return w;
}

export function tokens(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]+/g) ?? [])
    .filter((w) => w.length > 1 && !STOP.has(w))
    .map(stem);
}

// Letter triplets of each word, so typos and different word endings still match.
function grams(ws: string[]): string[] {
  const out: string[] = [];
  for (const w of ws) {
    const p = `  ${w} `;
    for (let i = 0; i + 3 <= p.length; i++) out.push(p.slice(i, i + 3));
  }
  return out;
}

function counts(terms: string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of terms) m.set(t, (m.get(t) ?? 0) + 1);
  return m;
}

// One "space" of terms: an inverted index plus the length of every chunk's vector.
class Space {
  private idf = new Map<string, number>();
  private post = new Map<string, [number, number][]>();
  private norms: number[] = [];
  private n: number;

  constructor(docs: string[][]) {
    this.n = docs.length;
    const tf = docs.map(counts);
    const df = new Map<string, number>();
    for (const c of tf) for (const t of c.keys()) df.set(t, (df.get(t) ?? 0) + 1);
    for (const [t, d] of df) this.idf.set(t, Math.log((this.n + 1) / (d + 1)) + 1);

    tf.forEach((c, i) => {
      let sum = 0;
      for (const [t, f] of c) {
        const w = (1 + Math.log(f)) * (this.idf.get(t) ?? 1);
        sum += w * w;
        let arr = this.post.get(t);
        if (!arr) { arr = []; this.post.set(t, arr); }
        arr.push([i, w]);
      }
      this.norms.push(Math.sqrt(sum));
    });
  }

  // Cosine similarity between the query and every chunk that shares a term with it.
  score(query: string[]): Map<number, number> {
    const unknown = Math.log(this.n + 1) + 1;
    const dot = new Map<number, number>();
    let qn = 0;
    for (const [t, f] of counts(query)) {
      const w = (1 + Math.log(f)) * (this.idf.get(t) ?? unknown);
      qn += w * w;
      for (const [i, dw] of this.post.get(t) ?? []) dot.set(i, (dot.get(i) ?? 0) + w * dw);
    }
    qn = Math.sqrt(qn);
    const out = new Map<number, number>();
    for (const [i, d] of dot) out.set(i, d / (qn * (this.norms[i] || 1)));
    return out;
  }
}

export class SearchIndex {
  private words: Space;
  private tri: Space;
  private owners = new Map<string, Set<string>>();

  constructor(private chunks: Chunk[]) {
    const toks = chunks.map((c) => tokens(c.text));
    this.words = new Space(toks);
    this.tri = new Space(toks.map(grams));
    chunks.forEach((c, i) => {
      let s = this.owners.get(c.owner);
      if (!s) { s = new Set(); this.owners.set(c.owner, s); }
      for (const t of toks[i]) s.add(t);
    });
  }

  search(query: string, min = 0.25, limit = 50): Hit[] {
    const q = tokens(query);
    if (q.length === 0) return [];

    const w = this.words.score(q);
    const t = this.tri.score(grams(q));
    const best = new Map<string, { score: number; where: Chunk["where"]; picture: boolean }>();

    for (const i of new Set([...w.keys(), ...t.keys()])) {
      const c = this.chunks[i];
      let s = Math.max(w.get(i) ?? 0, 0.9 * (t.get(i) ?? 0));
      if (c.where === "title") s = Math.min(1, s * 1.15);
      const cur = best.get(c.owner) ?? { score: 0, where: c.where, picture: false };
      if (s > cur.score) { cur.score = s; cur.where = c.where; }
      if (c.where === "picture" && s >= 0.25) cur.picture = true;
      best.set(c.owner, cur);
    }

    const out: Hit[] = [];
    for (const [owner, b] of best) {
      const have = this.owners.get(owner) ?? new Set<string>();
      const all = q.every((x) => have.has(x)); // every word found somewhere in the entry
      const score = Math.min(1, b.score + (all ? 0.2 : 0));
      if (score >= min) out.push({ owner, score, where: b.where, picture: b.picture });
    }
    return out.sort((a, b) => b.score - a.score).slice(0, limit);
  }
}
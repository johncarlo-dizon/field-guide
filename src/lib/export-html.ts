import { itemTree, parseText, type Li } from "@/lib/richtext";

export const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

// The text without the formatting marks.
export const plain = (t: string) => t.replace(/\*\*|==/g, "").replace(/^ *- /gm, "");

// JSON that is safe to place inside a <script> tag.
export const safeJson = (v: unknown) =>
  JSON.stringify(v).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");

// Lets long paths wrap after \ and / without adding any visible characters, so copying still gives the exact path.
const wb = (s: string) => s.replace(/([\\/])/g, "$1<wbr>");

function inline(text: string): string {
  const re = /\*\*(.+?)\*\*|==(.+?)==/g;
  let out = "";
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    out += wb(esc(text.slice(last, m.index)));
    out += m[1] !== undefined ? `<strong>${inline(m[1])}</strong>` : `<mark>${inline(m[2])}</mark>`;
    last = m.index + m[0].length;
  }
  return out + wb(esc(text.slice(last)));
}

function list(nodes: Li[], depth: number): string {
  const kind = ["disc", "circle", "square"][depth % 3];
  return (
    `<ul style="list-style-type:${kind}">` +
    nodes.map((n) => `<li>${inline(n.text)}${n.children.length ? list(n.children, depth + 1) : ""}</li>`).join("") +
    `</ul>`
  );
}

export function richToHtml(text: string): string {
  return parseText(text)
    .map((b) => (b.kind === "ul" ? list(itemTree(b.items), 0) : `<p>${inline(b.lines.join("\n"))}</p>`))
    .join("");
}

const CSS = `
*{box-sizing:border-box}
body{margin:0;background:#f5f5f5;color:#171717;font-size:16px;line-height:1.5;font-family:system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif}
header{position:sticky;top:0;z-index:5;background:#fff;border-bottom:1px solid #e4e4e4;padding:12px 16px}
.wrap{max-width:760px;margin:0 auto}
h1{font-size:20px;margin:0}
.sub{color:#5f5f5f;font-size:13px;margin:2px 0 10px}
.tabs{display:flex;gap:8px;margin-bottom:10px}
.tab{flex:1;min-height:42px;border-radius:12px;border:1px solid #e4e4e4;background:#fafafa;font-weight:600;font-size:15px;font-family:inherit;color:#171717}
.tab.on{background:#262626;color:#fff;border-color:#262626}
#q{width:100%;height:46px;padding:0 14px;border-radius:12px;border:1px solid #e4e4e4;font-size:16px;font-family:inherit}
main{padding:12px 16px 40px}
#hint{color:#5f5f5f;font-size:13px;margin:0 0 4px}
#list{display:flex;flex-direction:column;gap:10px;margin-top:10px}
.entry,.proc{background:#fff;border:1px solid #e4e4e4;border-radius:14px}
.proc{background:#fafafa;margin:12px 0 0}
summary{padding:14px 16px;cursor:pointer}
.row{display:flex;gap:12px;align-items:flex-start}
.row b{flex:1;min-width:0}
.pct{flex:none;white-space:nowrap;border:1px solid #5f5f5f;color:#5f5f5f;border-radius:99px;padding:2px 10px;font-size:12px;font-weight:600}
.pct.hi{border-color:#1f7a46;color:#1f7a46}
.pct.mid{border-color:#262626;color:#262626}
.meta,.where{display:block;color:#5f5f5f;font-size:13px;margin-top:4px;font-weight:400}
.body{padding:0 16px 16px;border-top:1px solid #eee}
.rt p{margin:12px 0 0;white-space:pre-wrap}
.rt,summary,figcaption{overflow-wrap:anywhere}
.rt ul{margin:12px 0 0;padding-left:28px}
.rt ul ul{margin:4px 0 0;padding-left:24px}
.rt li+li{margin-top:4px}
mark{background:#fff3a3;color:inherit;padding:0 2px;border-radius:3px}
figure{margin:12px 0 0}
figure img{max-width:100%;border-radius:10px;border:1px solid #e4e4e4;display:block}
figcaption{color:#5f5f5f;font-size:14px;margin-top:4px}
.nopic{border:1px dashed #d4d4d4;border-radius:10px;padding:16px;color:#5f5f5f}
#empty{text-align:center;color:#5f5f5f;padding:24px}
`;

// The search that runs inside the file. It is the same method as in the app:
// cosine similarity on word weights (TF-IDF) plus letter triplets, over short pieces of each entry.
const JS = String.raw`
(function () {
  var DATA = JSON.parse(document.getElementById('fg-data').textContent);
  var CH = DATA.c;
  var LABEL = ['the title', 'the steps', 'a picture'];
  var STOP = new Set('a an and are as at be but by for from has have i if in into is it its of on or that the their then there these they this to was were will with you your not no do does did can could should would'.split(' '));

  function stem(w) {
    var n = w.length;
    if (n > 4 && w.slice(-3) === 'ing') return w.slice(0, -3);
    if (n > 4 && w.slice(-2) === 'ed') return w.slice(0, -2);
    if (n > 3 && w.slice(-2) === 'es') return w.slice(0, -2);
    if (n > 3 && w.slice(-1) === 's' && w.slice(-2) !== 'ss') return w.slice(0, -1);
    return w;
  }
  function tokens(text) {
    return (text.toLowerCase().match(/[a-z0-9]+/g) || [])
      .filter(function (w) { return w.length > 1 && !STOP.has(w); })
      .map(stem);
  }
  function grams(ws) {
    var out = [];
    ws.forEach(function (w) {
      var p = '  ' + w + ' ';
      for (var i = 0; i + 3 <= p.length; i++) out.push(p.slice(i, i + 3));
    });
    return out;
  }
  function counts(terms) {
    var m = new Map();
    terms.forEach(function (t) { m.set(t, (m.get(t) || 0) + 1); });
    return m;
  }

  function Space(docs) {
    var self = this;
    var n = docs.length;
    this.n = n;
    this.idf = new Map();
    this.post = new Map();
    this.norms = [];
    var tf = docs.map(counts);
    var df = new Map();
    tf.forEach(function (c) { c.forEach(function (f, t) { df.set(t, (df.get(t) || 0) + 1); }); });
    df.forEach(function (d, t) { self.idf.set(t, Math.log((n + 1) / (d + 1)) + 1); });
    tf.forEach(function (c, i) {
      var sum = 0;
      c.forEach(function (f, t) {
        var w = (1 + Math.log(f)) * self.idf.get(t);
        sum += w * w;
        var arr = self.post.get(t);
        if (!arr) { arr = []; self.post.set(t, arr); }
        arr.push([i, w]);
      });
      self.norms.push(Math.sqrt(sum));
    });
  }
  Space.prototype.score = function (query) {
    var self = this;
    var unknown = Math.log(this.n + 1) + 1;
    var dot = new Map();
    var qn = 0;
    counts(query).forEach(function (f, t) {
      var idf = self.idf.has(t) ? self.idf.get(t) : unknown;
      var w = (1 + Math.log(f)) * idf;
      qn += w * w;
      var arr = self.post.get(t) || [];
      for (var k = 0; k < arr.length; k++) {
        var i = arr[k][0];
        dot.set(i, (dot.get(i) || 0) + w * arr[k][1]);
      }
    });
    qn = Math.sqrt(qn);
    var out = new Map();
    dot.forEach(function (d, i) { out.set(i, d / (qn * (self.norms[i] || 1))); });
    return out;
  };

  var toks = CH.map(function (c) { return tokens(c[2]); });
  var words = new Space(toks);
  var tri = new Space(toks.map(grams));
  var owners = new Map();
  CH.forEach(function (c, i) {
    var s = owners.get(c[0]);
    if (!s) { s = new Set(); owners.set(c[0], s); }
    toks[i].forEach(function (t) { s.add(t); });
  });

  function fallback(query) {
    var low = query.toLowerCase();
    var seen = new Map();
    CH.forEach(function (c) {
      if (!seen.has(c[0]) && c[2].toLowerCase().indexOf(low) !== -1) seen.set(c[0], c[1]);
    });
    var out = [];
    seen.forEach(function (w, o) { out.push({ o: o, s: -1, w: w }); });
    out.sort(function (a, b) { return a.o - b.o; });
    return out;
  }

  function rank(query) {
    var q = tokens(query);
    if (!q.length) return fallback(query);
    var w = words.score(q);
    var t = tri.score(grams(q));
    var ids = new Set();
    w.forEach(function (v, i) { ids.add(i); });
    t.forEach(function (v, i) { ids.add(i); });
    var best = new Map();
    ids.forEach(function (i) {
      var c = CH[i];
      var s = Math.max(w.get(i) || 0, 0.9 * (t.get(i) || 0));
      if (c[1] === 0) s = Math.min(1, s * 1.15);
      var cur = best.get(c[0]);
      if (!cur) { cur = { s: 0, w: c[1] }; best.set(c[0], cur); }
      if (s > cur.s) { cur.s = s; cur.w = c[1]; }
    });
    var out = [];
    best.forEach(function (b, o) {
      var have = owners.get(o);
      var all = true;
      for (var k = 0; k < q.length; k++) {
        if (!have || !have.has(q[k])) { all = false; break; }
      }
      var score = Math.min(1, b.s + (all ? 0.2 : 0));
      if (score >= 0.25) out.push({ o: o, s: score, w: b.w });
    });
    out.sort(function (a, b) { return b.s - a.s; });
    return out;
  }

  var q = document.getElementById('q');
  var hint = document.getElementById('hint');
  var empty = document.getElementById('empty');
  var entries = Array.prototype.slice.call(document.querySelectorAll('.entry'));
  var tabs = Array.prototype.slice.call(document.querySelectorAll('.tab'));
  var kind = 'errors';

  function apply() {
    var query = q.value.trim();
    var ranked = query ? rank(query) : null;
    var info = new Map();
    if (ranked) ranked.forEach(function (h, pos) { info.set(h.o, { h: h, pos: pos }); });

    var shown = 0;
    var scored = false;
    entries.forEach(function (e) {
      var i = Number(e.getAttribute('data-i'));
      var pct = e.querySelector('.pct');
      var where = e.querySelector('.where');
      var ok = e.getAttribute('data-kind') === kind;
      pct.style.display = 'none';
      where.style.display = 'none';
      e.style.order = i;
      if (ok && ranked) {
        var r = info.get(i);
        if (!r) {
          ok = false;
        } else {
          e.style.order = r.pos;
          if (r.h.s >= 0) {
            scored = true;
            pct.textContent = Math.round(r.h.s * 100) + '% match';
            pct.className = 'pct ' + (r.h.s >= 0.7 ? 'hi' : r.h.s >= 0.45 ? 'mid' : 'lo');
            pct.style.display = '';
            where.textContent = 'Closest match is in ' + LABEL[r.h.w];
            where.style.display = 'block';
          }
        }
      }
      e.style.display = ok ? '' : 'none';
      if (ok) shown++;
    });
    hint.style.display = scored && shown ? '' : 'none';
    empty.style.display = shown ? 'none' : '';
    tabs.forEach(function (t) {
      t.className = 'tab' + (t.getAttribute('data-kind') === kind ? ' on' : '');
    });
  }

  tabs.forEach(function (t) {
    t.addEventListener('click', function () { kind = t.getAttribute('data-kind'); apply(); });
  });
  q.addEventListener('input', apply);
  apply();
})();
`;

export function pageHtml(o: {
  date: string;
  by: string;
  errorCount: number;
  procCount: number;
  errorsHtml: string;
  procsHtml: string;
  dataJson: string;
}): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>FieldGuide offline copy</title><style>${CSS}</style></head>
<body>
<header><div class="wrap">
<h1>FieldGuide offline copy</h1>
<div class="sub">Made on ${esc(o.date)} by ${esc(o.by)}. Read only. Download a new copy on the company network to refresh it.</div>
<div class="tabs"><button class="tab on" data-kind="errors">Errors (${o.errorCount})</button><button class="tab" data-kind="procedures">Procedures (${o.procCount})</button></div>
<input id="q" type="search" placeholder="Describe the problem, in your own words" aria-label="Search">
</div></header>
<main><div class="wrap">
<div id="hint" style="display:none">Closest matches first. The percentage shows how close each one is.</div>
<div id="list">${o.errorsHtml}${o.procsHtml}</div>
<div id="empty" style="display:none">No close matches. Try other words.</div>
</div></main>
<script type="application/json" id="fg-data">${o.dataJson}</script>
<script>${JS}</script>
</body></html>`;
}
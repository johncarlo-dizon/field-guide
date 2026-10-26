import { itemTree, parseText, type Li } from "@/lib/richtext";

export const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

// The text without the formatting marks, used for searching.
export const plain = (t: string) => t.replace(/\*\*|==/g, "").replace(/^ *- /gm, "");

function inline(text: string): string {
  const re = /\*\*(.+?)\*\*|==(.+?)==/g;
  let out = "";
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    out += esc(text.slice(last, m.index));
    out += m[1] !== undefined ? `<strong>${inline(m[1])}</strong>` : `<mark>${inline(m[2])}</mark>`;
    last = m.index + m[0].length;
  }
  return out + esc(text.slice(last));
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
.entry,.proc{background:#fff;border:1px solid #e4e4e4;border-radius:14px;margin:10px 0}
.proc{background:#fafafa;margin:12px 0 0}
summary{padding:14px 16px;cursor:pointer}
.meta{display:block;color:#5f5f5f;font-size:13px;margin-top:4px;font-weight:400}
.body{padding:0 16px 16px;border-top:1px solid #eee}
.rt p{margin:12px 0 0;white-space:pre-wrap}
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

const JS = `
(function () {
  var q = document.getElementById('q');
  var entries = Array.prototype.slice.call(document.querySelectorAll('.entry'));
  var tabs = Array.prototype.slice.call(document.querySelectorAll('.tab'));
  var empty = document.getElementById('empty');
  var kind = 'errors';
  function apply() {
    var words = q.value.toLowerCase().split(/\\s+/).filter(Boolean);
    var shown = 0;
    entries.forEach(function (e) {
      var ok = e.getAttribute('data-kind') === kind;
      if (ok) {
        var s = e.getAttribute('data-s');
        for (var i = 0; i < words.length; i++) {
          if (s.indexOf(words[i]) === -1) { ok = false; break; }
        }
      }
      e.style.display = ok ? '' : 'none';
      if (ok) shown++;
    });
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
}): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>FieldGuide offline copy</title><style>${CSS}</style></head>
<body>
<header><div class="wrap">
<h1>FieldGuide offline copy</h1>
<div class="sub">Made on ${esc(o.date)} by ${esc(o.by)}. Read only. Download a new copy on the company network to refresh it.</div>
<div class="tabs"><button class="tab on" data-kind="errors">Errors (${o.errorCount})</button><button class="tab" data-kind="procedures">Procedures (${o.procCount})</button></div>
<input id="q" type="search" placeholder="Search errors, steps and text in pictures" aria-label="Search">
</div></header>
<main><div class="wrap">
${o.errorsHtml}${o.procsHtml}
<div id="empty" style="display:none">Nothing found.</div>
</div></main>
<script>${JS}</script>
</body></html>`;
}
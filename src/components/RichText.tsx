import type { CSSProperties, ReactNode } from "react";
import { itemTree, parseText, type Li } from "@/lib/richtext";

const mark: CSSProperties = { background: "#fff3a3", color: "inherit", padding: "0 2px", borderRadius: 3 };

// Lets long paths wrap after \ and / without adding any characters, so copying still gives the exact path.
function breakable(text: string, key: string): ReactNode[] {
  const out: ReactNode[] = [];
  text.split(/([\\/])/).forEach((p, i) => {
    if (p === "") return;
    out.push(p);
    if (p === "\\" || p === "/") out.push(<wbr key={`${key}w${i}`} />);
  });
  return out;
}

// **bold** and ==highlight==, which may be nested inside each other.
function inline(text: string, prefix = ""): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\*\*(.+?)\*\*|==(.+?)==/g;
  let last = 0;
  let n = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(...breakable(text.slice(last, m.index), `${prefix}${n++}t`));
    const key = `${prefix}${n++}`;
    if (m[1] !== undefined) out.push(<strong key={key}>{inline(m[1], key + "-")}</strong>);
    else out.push(<mark key={key} style={mark}>{inline(m[2], key + "-")}</mark>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(...breakable(text.slice(last), `${prefix}${n++}t`));
  return out;
}

const MARKERS = ["disc", "circle", "square"] as const;

function renderList(nodes: Li[], depth: number, top: number): ReactNode {
  return (
    <ul
      style={{
        margin: 0,
        marginTop: top,
        paddingLeft: depth === 0 ? 28 : 24,
        lineHeight: 1.55,
        listStyleType: MARKERS[depth % 3],
      }}
    >
      {nodes.map((n, i) => (
        <li key={i} style={{ marginTop: i ? 4 : 0, paddingLeft: 2 }}>
          {inline(n.text)}
          {n.children.length > 0 && renderList(n.children, depth + 1, 4)}
        </li>
      ))}
    </ul>
  );
}

export default function RichText({ text }: { text: string }) {
  const blocks = parseText(text).map((b, i) => {
    const top = i === 0 ? 0 : 12;
    if (b.kind === "ul") return <div key={i}>{renderList(itemTree(b.items), 0, top)}</div>;
    return (
      <p key={i} style={{ margin: 0, marginTop: top, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>
        {inline(b.lines.join("\n"))}
      </p>
    );
  });
  // Very long words (a file name with no slashes, for example) wrap instead of running off the card.
  return <div style={{ overflowWrap: "anywhere" }}>{blocks}</div>;
}
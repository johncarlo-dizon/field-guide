"use client";

import type { CSSProperties } from "react";
import TextEditor from "@/components/TextEditor";
import { color, ui } from "@/lib/ui";

export type BlockData =
  | { key: number; type: "text"; content: string }
  | { key: number; type: "image"; attachmentId: string; caption: string };

type Props = {
  block: BlockData;
  first: boolean;
  last: boolean;
  onMove: (d: number) => void;
  onRemove: () => void;
  onText: (v: string) => void;
  onCaption: (v: string) => void;
};

const mini: CSSProperties = { ...ui.btn, ...ui.small, minWidth: 36 };

export default function BlockItem({ block, first, last, onMove, onRemove, onText, onCaption }: Props) {
  return (
    <div style={{ background: color.card, border: `1px solid ${color.line}`, borderRadius: 14, margin: "10px 0", padding: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
        <b style={{ flex: 1, fontSize: 14 }}>{block.type === "text" ? "Text" : "Picture"}</b>
        <button type="button" style={mini} onClick={() => onMove(-1)} disabled={first} aria-label="Move up">&uarr;</button>
        <button type="button" style={mini} onClick={() => onMove(1)} disabled={last} aria-label="Move down">&darr;</button>
        <button type="button" style={{ ...mini, color: color.danger }} onClick={onRemove}>Remove</button>
      </div>

      {block.type === "text" ? (
        <TextEditor value={block.content} onChange={onText} />
      ) : (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/attachments/${block.attachmentId}?thumb=1`}
            alt="Uploaded screenshot"
            style={{ maxWidth: "100%", borderRadius: 10, border: `1px solid ${color.line}`, display: "block" }}
          />
          <input
            value={block.caption}
            onChange={(e) => onCaption(e.target.value)}
            maxLength={200}
            placeholder="Caption (optional)"
            style={{ ...ui.field, marginTop: 8 }}
          />
        </>
      )}
    </div>
  );
}
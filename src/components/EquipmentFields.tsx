"use client";

import type { FormLabels } from "@/components/ProcedureForm";
import { ui } from "@/lib/ui";

export const EQ_LABELS: Partial<FormLabels> = {
  title: "Name",
  titleHint: "For example: POS to printer cable",
  part: "Part name",
  partHint: "For example: End A (round plug)",
  addPart: "+ Add part",
  untitled: "Untitled part",
  noun: "part",
};

type Props = {
  summary: string;
  setSummary: (v: string) => void;
};

export default function EquipmentFields({ summary, setSummary }: Props) {
  return (
    <label style={{ display: "block", marginTop: 14 }}>
      <b>What it is for</b>
      <textarea
        value={summary}
        onChange={(e) => setSummary(e.target.value)}
        maxLength={300}
        rows={2}
        placeholder="One or two short sentences"
        style={{ ...ui.field, marginTop: 6, resize: "vertical" }}
      />
    </label>
  );
}
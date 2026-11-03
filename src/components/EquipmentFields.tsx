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
  category: string;
  setCategory: (v: string) => void;
  model: string;
  setModel: (v: string) => void;
  summary: string;
  setSummary: (v: string) => void;
  categories: string[];
};

export default function EquipmentFields({ category, setCategory, model, setModel, summary, setSummary, categories }: Props) {
  const label = { display: "block", marginTop: 14 } as const;
  return (
    <>
      <label style={label}>
        <b>Category</b>
        <input
          list="eq-categories" value={category} onChange={(e) => setCategory(e.target.value)} maxLength={60}
          placeholder="For example: Cables" style={{ ...ui.field, marginTop: 6 }}
        />
        <datalist id="eq-categories">
          {categories.map((c) => <option key={c} value={c} />)}
        </datalist>
      </label>
      <label style={label}>
        <b>Model or part number (optional)</b>
        <input
          value={model} onChange={(e) => setModel(e.target.value)} maxLength={80}
          placeholder="As printed on the label" style={{ ...ui.field, marginTop: 6 }}
        />
      </label>
      <label style={label}>
        <b>What it is for</b>
        <textarea
          value={summary} onChange={(e) => setSummary(e.target.value)} maxLength={300} rows={2}
          placeholder="One or two short sentences" style={{ ...ui.field, marginTop: 6, resize: "vertical" }}
        />
      </label>
    </>
  );
}
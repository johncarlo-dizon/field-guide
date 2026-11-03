"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import EquipmentFields, { EQ_LABELS } from "@/components/EquipmentFields";
import ProcedureForm, { type ProcPayload } from "@/components/ProcedureForm";

export default function NewEquipment() {
  const router = useRouter();
  const [category, setCategory] = useState("");
  const [model, setModel] = useState("");
  const [summary, setSummary] = useState("");
  const [cats, setCats] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/equipment");
      const data = await res.json().catch(() => ({}));
      if (data.ok) setCats(data.categories ?? []);
    })();
  }, []);

  async function submit(p: ProcPayload): Promise<string | null> {
    const res = await fetch("/api/equipment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: p.title, category, modelNumber: model, summary, parts: p.processes }),
    });
    if (res.status === 401) { window.location.href = "/"; return null; }
    const data = await res.json().catch(() => ({}));
    if (data.ok) { router.push(`/equipment/${data.id}`); return null; }
    return data.error ?? "Could not save";
  }

  return (
    <ProcedureForm
      heading="Add equipment"
      backHref="/equipment"
      backLabel="All equipment"
      submitLabel="Save equipment"
      labels={EQ_LABELS}
      extra={
        <EquipmentFields
          category={category} setCategory={setCategory}
          model={model} setModel={setModel}
          summary={summary} setSummary={setSummary}
          categories={cats}
        />
      }
      onSubmit={submit}
    />
  );
}
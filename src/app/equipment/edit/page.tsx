"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import EquipmentFields, { EQ_LABELS } from "@/components/EquipmentFields";
import ProcedureForm, { type ProcInitial, type ProcPayload } from "@/components/ProcedureForm";
import { color, ui } from "@/lib/ui";

type LoadedBlock = {
  type: "text" | "image";
  content: string;
  caption: string;
  attachmentId: string | null;
};
type LoadedPart = { title: string; blocks: LoadedBlock[] };

export default function EditEquipment() {
  const params = useParams();
  const router = useRouter();
  const id = String(params.id);
  const [initial, setInitial] = useState<ProcInitial | null>(null);
  const [category, setCategory] = useState("");
  const [model, setModel] = useState("");
  const [summary, setSummary] = useState("");
  const [cats, setCats] = useState<string[]>([]);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      const [res, list] = await Promise.all([fetch(`/api/equipment/${id}`), fetch("/api/equipment")]);
      if (res.status === 401) { window.location.href = "/"; return; }
      const data = await res.json().catch(() => ({}));
      const all = await list.json().catch(() => ({}));
      if (all.ok) setCats(all.categories ?? []);
      if (!data.ok) { setMsg(data.error ?? "Could not load this equipment"); return; }

      const e = data.equipment;
      if (!e.canEdit) { setMsg(`Only ${e.authorName} can edit this equipment.`); return; }
      setCategory(e.category);
      setModel(e.modelNumber);
      setSummary(e.summary);
      setInitial({
        title: e.name,
        processes: (e.parts as LoadedPart[]).map((x) => ({
          title: x.title,
          blocks: x.blocks.map((b) => ({
            type: b.type,
            content: b.content,
            caption: b.caption,
            attachmentId: b.attachmentId,
          })),
        })),
      });
    })();
  }, [id]);

  async function submit(p: ProcPayload): Promise<string | null> {
    const res = await fetch(`/api/equipment/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: p.title, category, modelNumber: model, summary, parts: p.processes }),
    });
    if (res.status === 401) { window.location.href = "/"; return null; }
    const data = await res.json().catch(() => ({}));
    if (data.ok) { router.push(`/equipment/${id}`); router.refresh(); return null; }
    return data.error ?? "Could not save the changes";
  }

  if (msg) {
    return (
      <AppShell>
        <p style={{ margin: "16px 0 0" }}>
          <Link href={`/equipment/${id}`} style={{ ...ui.muted, fontSize: 14 }}>&larr; Back to the equipment</Link>
        </p>
        <p style={{ color: color.danger }}>{msg}</p>
      </AppShell>
    );
  }
  if (!initial) {
    return (
      <AppShell>
        <p style={ui.muted}>Loading...</p>
      </AppShell>
    );
  }

  return (
    <ProcedureForm
      heading="Edit equipment"
      backHref={`/equipment/${id}`}
      backLabel="Cancel"
      submitLabel="Save changes"
      initial={initial}
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
"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import ProcedureForm, { type ProcInitial, type ProcPayload } from "@/components/ProcedureForm";
import { color, ui } from "@/lib/ui";

type LoadedBlock = {
  type: "text" | "image";
  content: string;
  caption: string;
  attachmentId: string | null;
};
type LoadedProcess = { title: string; blocks: LoadedBlock[] };

export default function EditProcedure() {
  const params = useParams();
  const router = useRouter();
  const id = String(params.id);
  const [initial, setInitial] = useState<ProcInitial | null>(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/procedures/${id}`);
      if (res.status === 401) { window.location.href = "/"; return; }
      const data = await res.json().catch(() => ({}));
      if (!data.ok) { setMsg(data.error ?? "Could not load this procedure"); return; }
      const p = data.procedure;
      if (!p.canEdit) { setMsg(`Only ${p.authorName} can edit this procedure.`); return; }
      setInitial({
        title: p.title,
        processes: (p.processes as LoadedProcess[]).map((x) => ({
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
    const res = await fetch(`/api/procedures/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(p),
    });
    if (res.status === 401) { window.location.href = "/"; return null; }
    const data = await res.json().catch(() => ({}));
    if (data.ok) { router.push(`/procedures/${id}`); router.refresh(); return null; }
    return data.error ?? "Could not save the changes";
  }

  if (msg) {
    return (
      <AppShell>
        <p style={{ margin: "16px 0 0" }}>
          <Link href={`/procedures/${id}`} style={{ ...ui.muted, fontSize: 14 }}>&larr; Back to the procedure</Link>
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
      heading="Edit procedure"
      backHref={`/procedures/${id}`}
      backLabel="Cancel"
      submitLabel="Save changes"
      initial={initial}
      onSubmit={submit}
    />
  );
}
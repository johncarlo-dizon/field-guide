"use client";

import { useRouter } from "next/navigation";
import ProcedureForm, { type ProcPayload } from "@/components/ProcedureForm";

export default function NewProcedure() {
  const router = useRouter();

  async function submit(p: ProcPayload): Promise<string | null> {
    const res = await fetch("/api/procedures", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(p),
    });
    if (res.status === 401) { window.location.href = "/"; return null; }
    const data = await res.json().catch(() => ({}));
    if (data.ok) { router.push(`/procedures/${data.id}`); return null; }
    return data.error ?? "Could not save";
  }

  return (
    <ProcedureForm
      heading="Add a procedure"
      backHref="/procedures"
      backLabel="All procedures"
      submitLabel="Save procedure"
      onSubmit={submit}
    />
  );
}
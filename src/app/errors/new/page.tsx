"use client";

import { useRouter } from "next/navigation";
import ErrorForm, { type Payload } from "@/components/ErrorForm";

export default function NewError() {
  const router = useRouter();

  async function submit(p: Payload): Promise<string | null> {
    const res = await fetch("/api/errors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(p),
    });
    if (res.status === 401) { window.location.href = "/"; return null; }
    const data = await res.json().catch(() => ({}));
    if (data.ok) { router.push(`/errors/${data.id}`); return null; }
    return data.error ?? "Could not save";
  }

  return (
    <ErrorForm
      heading="Add a new error"
      backHref="/errors"
      backLabel="Back to the list"
      submitLabel="Save error"
      onSubmit={submit}
    />
  );
}
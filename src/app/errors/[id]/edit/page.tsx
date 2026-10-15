"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import ErrorForm, { type Initial, type Payload } from "@/components/ErrorForm";

type LoadedBlock = {
  type: "text" | "image";
  content: string;
  caption: string;
  attachmentId: string | null;
};

export default function EditError() {
  const params = useParams();
  const router = useRouter();
  const id = String(params.id);
  const [initial, setInitial] = useState<Initial | null>(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/errors/${id}`);
      if (res.status === 401) { window.location.href = "/"; return; }
      const data = await res.json().catch(() => ({}));
      if (!data.ok) { setMsg(data.error ?? "Could not load this error"); return; }
      const e = data.error;
      if (!e.canEdit) { setMsg(`Only ${e.authorName} can edit this entry.`); return; }
      setInitial({
        title: e.title,
        status: e.status,
        blocks: (e.blocks as LoadedBlock[]).map((b) => ({
          type: b.type,
          content: b.content,
          caption: b.caption,
          attachmentId: b.attachmentId,
        })),
      });
    })();
  }, [id]);

  async function submit(p: Payload): Promise<string | null> {
    const res = await fetch(`/api/errors/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(p),
    });
    if (res.status === 401) { window.location.href = "/"; return null; }
    const data = await res.json().catch(() => ({}));
    if (data.ok) { router.push(`/errors/${id}`); router.refresh(); return null; }
    return data.error ?? "Could not save the changes";
  }

  if (msg) {
    return (
      <main style={{ maxWidth: 720, margin: "0 auto", padding: 24 }}>
        <p style={{ margin: 0 }}><Link href={`/errors/${id}`}>&larr; Back to the error</Link></p>
        <p style={{ color: "#c0392b" }}>{msg}</p>
      </main>
    );
  }
  if (!initial) {
    return <main style={{ maxWidth: 720, margin: "0 auto", padding: 24 }}><p>Loading...</p></main>;
  }

  return (
    <ErrorForm
      heading="Edit error"
      backHref={`/errors/${id}`}
      backLabel="Cancel"
      submitLabel="Save changes"
      showStatus
      initial={initial}
      onSubmit={submit}
    />
  );
}
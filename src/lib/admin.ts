import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

export async function requireAdmin() {
  const me = await getCurrentUser();
  if (!me) {
    return { error: NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 }) } as const;
  }
  if (me.role !== "admin") {
    return { error: NextResponse.json({ ok: false, error: "Admins only" }, { status: 403 }) } as const;
  }
  return { me } as const;
}
import { createHash, randomBytes } from "crypto";
import { cookies } from "next/headers";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/lib/db";
import { sessions, users } from "@/db/schema";

export const SESSION_COOKIE = "fg_session";
export const MAX_ATTEMPTS = 5; // wrong PINs before the account locks
export const LOCK_MINUTES = 15;
const SESSION_DAYS = 14;

const sha = (t: string) => createHash("sha256").update(t).digest("hex");

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await db.insert(sessions).values({ userId, tokenHash: sha(token), expiresAt });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.COOKIE_SECURE === "true",
    path: "/",
    expires: expiresAt,
  });
}

export async function getCurrentUser() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const rows = await db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      position: users.position,
      role: users.role,
      mustChangePin: users.mustChangePin,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(
      and(
        eq(sessions.tokenHash, sha(token)),
        gt(sessions.expiresAt, new Date()),
        eq(users.isActive, true)
      )
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.delete(sessions).where(eq(sessions.tokenHash, sha(token)));
  jar.delete(SESSION_COOKIE);
}
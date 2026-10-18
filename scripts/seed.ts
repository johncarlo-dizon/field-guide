import "./env";
import { randomInt } from "crypto";
import { eq } from "drizzle-orm";
import { db, pool } from "../src/lib/db";
import { users } from "../src/db/schema";
import { hashPin, pinProblem } from "../src/lib/pin";

type Seed = { username: string; displayName: string; position: string; role: "user" | "admin" };

function randomPin(): string {
  for (;;) {
    const p = String(randomInt(0, 10000)).padStart(4, "0");
    if (!pinProblem(p)) return p;
  }
}

async function ensureUser(u: Seed) {
  const existing = await db.select({ id: users.id }).from(users).where(eq(users.username, u.username)).limit(1);
  if (existing.length) {
    console.log(`- ${u.username}: already exists, skipped`);
    return;
  }
  const pin = randomPin();
  await db.insert(users).values({ ...u, pinHash: await hashPin(pin), mustChangePin: true });
  console.log(`- ${u.username} (${u.displayName}): created, temporary PIN ${pin}`);
}

async function main() {
  console.log("Seeding users (temporary PINs are shown only once):");
  await ensureUser({ username: "admin", displayName: "Administrator", position: "Admin", role: "admin" });
  if (process.argv.includes("--samples")) {
    await ensureUser({ username: "yops", displayName: "Christian Mark Tabora", position: "IT Supervisor", role: "user" });
    await ensureUser({ username: "jv", displayName: "John Carlo Dizon", position: "IT Assistant", role: "user" });
  }
  await pool.end();
}

main().catch(async (e) => {
  console.error(e);
  await pool.end();
  process.exit(1);
});
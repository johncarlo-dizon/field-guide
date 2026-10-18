import "./env";
import { randomInt } from "crypto";
import { eq } from "drizzle-orm";
import { db, pool } from "../src/lib/db";
import { sessions, users } from "../src/db/schema";
import { hashPin, pinProblem } from "../src/lib/pin";

const [cmd, ...rest] = process.argv.slice(2);

function opt(name: string): string | undefined {
  const i = rest.indexOf(`--${name}`);
  return i >= 0 && i + 1 < rest.length && !rest[i + 1].startsWith("--") ? rest[i + 1] : undefined;
}
const flag = (name: string) => rest.includes(`--${name}`);

function die(msg: string): never {
  console.error(msg);
  process.exit(1);
}

function randomPin(): string {
  for (;;) {
    const p = String(randomInt(0, 10000)).padStart(4, "0");
    if (!pinProblem(p)) return p;
  }
}

async function find() {
  const username = opt("username")?.toLowerCase();
  if (!username) die("Missing --username");
  const [u] = await db.select().from(users).where(eq(users.username, username)).limit(1);
  if (!u) die(`No user with username "${username}". See the list with: npm run user -- list`);
  return u;
}

async function main() {
  switch (cmd) {
    case "list": {
      const rows = await db.select().from(users).orderBy(users.displayName);
      console.table(
        rows.map((u) => ({
          username: u.username,
          name: u.displayName,
          position: u.position,
          role: u.role,
          active: u.isActive,
          locked: !!u.lockedUntil && u.lockedUntil > new Date(),
          mustChangePin: u.mustChangePin,
        }))
      );
      break;
    }

    case "add": {
      const username = opt("username")?.toLowerCase();
      const name = opt("name");
      const position = opt("position");
      if (!username || !name || !position) {
        die('Usage: npm run user -- add --username jose --name "Jose Santos" --position "Field Support" [--admin]');
      }
      if (!/^[a-z0-9._-]{2,30}$/.test(username)) {
        die("The username must be 2 to 30 characters: letters, numbers, dot, dash or underscore");
      }
      const [exists] = await db.select({ id: users.id }).from(users).where(eq(users.username, username)).limit(1);
      if (exists) die(`The username "${username}" is already taken`);

      const pin = randomPin();
      await db.insert(users).values({
        username,
        displayName: name,
        position,
        role: flag("admin") ? "admin" : "user",
        pinHash: await hashPin(pin),
        mustChangePin: true,
      });
      console.log(`Created ${name} (${username}). Temporary PIN: ${pin}`);
      console.log("Give them this PIN. They will choose their own at the first login.");
      break;
    }

    case "reset-pin": {
      const u = await find();
      const pin = randomPin();
      await db
        .update(users)
        .set({ pinHash: await hashPin(pin), mustChangePin: true, failedAttempts: 0, lockedUntil: null, updatedAt: new Date() })
        .where(eq(users.id, u.id));
      await db.delete(sessions).where(eq(sessions.userId, u.id));
      console.log(`New temporary PIN for ${u.displayName}: ${pin}`);
      break;
    }

    case "unlock": {
      const u = await find();
      await db.update(users).set({ failedAttempts: 0, lockedUntil: null, updatedAt: new Date() }).where(eq(users.id, u.id));
      console.log(`Unlocked ${u.displayName}`);
      break;
    }

    case "deactivate": {
      const u = await find();
      await db.update(users).set({ isActive: false, updatedAt: new Date() }).where(eq(users.id, u.id));
      await db.delete(sessions).where(eq(sessions.userId, u.id));
      console.log(`Deactivated ${u.displayName}. Their entries stay, and they can no longer log in.`);
      break;
    }

    case "activate": {
      const u = await find();
      await db.update(users).set({ isActive: true, updatedAt: new Date() }).where(eq(users.id, u.id));
      console.log(`Activated ${u.displayName}`);
      break;
    }

    case "role": {
      const u = await find();
      if (flag("admin") === flag("user")) die("Choose one: --admin or --user");
      const role = flag("admin") ? "admin" : "user";
      await db.update(users).set({ role, updatedAt: new Date() }).where(eq(users.id, u.id));
      console.log(`${u.displayName} is now ${role}`);
      break;
    }

    default:
      console.log(`Commands:
  list
  add --username x --name "Full Name" --position "Position" [--admin]
  reset-pin --username x
  unlock --username x
  deactivate --username x
  activate --username x
  role --username x --admin | --user`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
import "./env";
import { and, eq, isNotNull } from "drizzle-orm";
import { db, pool } from "../src/lib/db";
import { errors, procedures, users } from "../src/db/schema";

const [cmd, id] = process.argv.slice(2);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function main() {
  if (cmd === "list") {
    const e = await db
      .select({ id: errors.id, title: errors.title, author: users.displayName, deletedAt: errors.deletedAt })
      .from(errors)
      .innerJoin(users, eq(errors.authorId, users.id))
      .where(isNotNull(errors.deletedAt));
    const p = await db
      .select({ id: procedures.id, title: procedures.title, author: users.displayName, deletedAt: procedures.deletedAt })
      .from(procedures)
      .innerJoin(users, eq(procedures.authorId, users.id))
      .where(isNotNull(procedures.deletedAt));
    console.log("Deleted errors:");
    console.table(e);
    console.log("Deleted procedures:");
    console.table(p);
    return;
  }

  if ((cmd === "error" || cmd === "procedure") && id && UUID.test(id)) {
    const table = cmd === "error" ? errors : procedures;
    const done = await db
      .update(table)
      .set({ deletedAt: null, updatedAt: new Date() })
      .where(and(eq(table.id, id), isNotNull(table.deletedAt)))
      .returning({ id: table.id });
    console.log(done.length ? `Restored ${cmd} ${id}` : "Nothing restored (wrong id, or it is not deleted)");
    return;
  }

  console.log(`Commands:
  list
  error <id>
  procedure <id>`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
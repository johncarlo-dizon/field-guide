import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@/db/schema";

// One shared connection pool. In dev, Next.js reloads modules often,
// so the pool is kept on globalThis to avoid opening too many connections.
const globalForPg = globalThis as unknown as { pgPool?: Pool };

export const pool =
  globalForPg.pgPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
  });

if (process.env.NODE_ENV !== "production") {
  globalForPg.pgPool = pool;
}

export const db = drizzle(pool, { schema });
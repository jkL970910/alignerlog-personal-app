import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";

import * as schema from "@/lib/db/schema";

let pool: Pool | null = null;

function getDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured.");
  }

  return databaseUrl;
}

export function getDb() {
  if (!pool) {
    pool = new Pool({ connectionString: getDatabaseUrl() });
  }

  return drizzle(pool, { schema });
}

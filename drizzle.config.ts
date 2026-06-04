import { existsSync } from "node:fs";

import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

if (existsSync(".env.local")) {
  config({ path: ".env.local" });
} else if (existsSync(".env")) {
  config({ path: ".env" });
}

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgresql://alignerlog@127.0.0.1:5433/alignerlog"
  }
});

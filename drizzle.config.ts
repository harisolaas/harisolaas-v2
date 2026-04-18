import { config } from "dotenv";
import type { Config } from "drizzle-kit";

config({ path: ".env.local" });

const url = process.env.DATABASE_URL_UNPOOLED;
if (!url) {
  throw new Error(
    "DATABASE_URL_UNPOOLED is required. Run `vercel env pull .env.local` first.",
  );
}

export default {
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: { url },
  casing: "snake_case",
} satisfies Config;

import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import * as schema from "./schema";

// Needed when running in Node (scripts, tests). Vercel serverless runtime
// provides its own WebSocket, but setting this unconditionally is safe.
neonConfig.webSocketConstructor = ws;

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error(
    "DATABASE_URL is required. Run `vercel env pull .env.local` locally, or set it in the deployment environment.",
  );
}

const pool = new Pool({ connectionString: url });

export const db = drizzle(pool, { schema });
export { schema };
export type DB = typeof db;

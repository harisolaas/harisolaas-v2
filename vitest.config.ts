import { defineConfig } from "vitest/config";
import { config } from "dotenv";
import path from "node:path";

config({ path: ".env.local" });

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    testTimeout: 20_000,
    pool: "forks",
    // Serialize across test files to avoid cross-test DB races against the
    // shared Neon dev branch.
    maxWorkers: 1,
    minWorkers: 1,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});

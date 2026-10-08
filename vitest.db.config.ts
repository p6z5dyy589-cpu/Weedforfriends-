import path from "node:path";
import { defineConfig } from "vitest/config";

// Database contract tests: only against a disposable test DB (TEST_DATABASE_URL).
export default defineConfig({
  resolve: { alias: { "@shared": path.resolve(import.meta.dirname, "shared") } },
  test: { include: ["server/**/*.db.test.ts"], environment: "node", fileParallelism: false },
});

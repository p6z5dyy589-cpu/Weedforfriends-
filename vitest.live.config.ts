import { defineConfig } from "vitest/config";

if (process.env.ALLOW_LIVE_TESTS !== "1") {
  throw new Error("Live-Tests nur bewusst mit ALLOW_LIVE_TESTS=1 starten.");
}

export default defineConfig({
  test: { include: ["**/*.live.test.ts"], exclude: ["node_modules/**"], environment: "node" },
});

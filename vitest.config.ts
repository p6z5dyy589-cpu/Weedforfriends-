import path from "node:path";
import { defineConfig } from "vitest/config";

// Standard suite: isolated, runs without Odoo/MySQL/Push/Deputy secrets.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client/src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
    },
  },
  test: {
    include: ["server/**/*.test.ts", "shared/**/*.test.ts", "client/src/**/*.test.{ts,tsx}"],
    exclude: ["**/*.live.test.ts", "node_modules/**"],
    environment: "node",
  },
});

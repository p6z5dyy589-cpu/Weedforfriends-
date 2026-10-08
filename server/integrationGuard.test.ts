import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(import.meta.dirname, "..");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [full] : [];
  });
}

describe("integration guard", () => {
  const files = ["client/src", "server", "shared"].flatMap((d) => sourceFiles(path.join(ROOT, d)));

  it("never reactivates WhatsApp or respond.io", () => {
    for (const f of files) {
      expect(readFileSync(f, "utf8"), f).not.toMatch(/whatsapp|respond\.io|respondio/i);
    }
  });

  it("has no Odoo, print, push, Slack or Deputy coupling in this foundation package", () => {
    for (const f of files) {
      expect(readFileSync(f, "utf8"), f).not.toMatch(/from\s+["'][^"']*(odoo|print|push|slack|deputy)[^"']*["']/i);
    }
  });
});

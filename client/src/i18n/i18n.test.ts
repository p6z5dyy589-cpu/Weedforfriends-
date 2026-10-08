import { describe, expect, it } from "vitest";
import { MODULES, cs, de } from "./index";
import { NAV_GROUPS, NAV_ITEMS } from "@shared/navigation";
import { BLOCK_REASONS, PROCESS_TYPES, TASK_STATUSES, UNITS, WORK_TYPES } from "@shared/tasks";

const FORBIDDEN_WORDS = /\b(RPC|tRPC|stock\.move|quant|manual_review|idempotent|force_company|SQL|HTTP|Stacktrace)\b/i;

describe("DE/CZ translations", () => {
  it("every module has the same keys in DE and CZ and no empty values", () => {
    for (const [name, mod] of Object.entries(MODULES)) {
      expect(Object.keys(mod.cs).sort(), name).toEqual(Object.keys(mod.de).sort());
      for (const [key, value] of [...Object.entries(mod.de), ...Object.entries(mod.cs)]) {
        expect(String(value).trim(), `${name}:${key}`).not.toBe("");
      }
    }
  });

  it("keys are unique across modules", () => {
    const seen = new Map<string, string>();
    for (const [name, mod] of Object.entries(MODULES)) {
      for (const key of Object.keys(mod.de)) {
        expect(seen.get(key), `${key} in ${name} and ${seen.get(key)}`).toBeUndefined();
        seen.set(key, name);
      }
    }
  });

  it("interpolation placeholders match between DE and CZ", () => {
    for (const key of Object.keys(de) as (keyof typeof de)[]) {
      const vars = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
      expect(vars(cs[key]), key).toEqual(vars(de[key]));
    }
  });

  it("cover navigation, statuses, process and work types, units and block reasons", () => {
    for (const g of NAV_GROUPS) expect(de).toHaveProperty(`nav.group.${g}`);
    for (const i of NAV_ITEMS) expect(de).toHaveProperty(i.labelKey);
    for (const s of TASK_STATUSES) expect(de).toHaveProperty(`status.${s}`);
    for (const p of PROCESS_TYPES) expect(de).toHaveProperty(`process.${p}`);
    for (const w of WORK_TYPES) expect(de).toHaveProperty(`work.${w}`);
    for (const u of UNITS) expect(de).toHaveProperty(`unit.${u}`);
    for (const b of BLOCK_REASONS) expect(de).toHaveProperty(`block.${b}`);
  });

  it("keeps the local-only and stop wording and avoids technical words for staff", () => {
    expect(de["app.localOnly"]).toBe("Lokal · nicht in Odoo gebucht");
    expect(de["home.clarify"]).toBe("Stopp – Klärung");
    for (const [key, value] of Object.entries(de)) expect(value, key).not.toMatch(FORBIDDEN_WORDS);
  });
});

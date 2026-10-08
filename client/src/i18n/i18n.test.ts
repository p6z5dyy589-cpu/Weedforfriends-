import { describe, expect, it } from "vitest";
import { de } from "./de";
import { cs } from "./cs";
import { NAV_GROUPS, NAV_ITEMS } from "@shared/navigation";

describe("DE/CZ translations", () => {
  it("have the same keys and no empty values", () => {
    expect(Object.keys(cs).sort()).toEqual(Object.keys(de).sort());
    for (const [key, value] of [...Object.entries(de), ...Object.entries(cs)]) {
      expect(value.trim(), key).not.toBe("");
    }
  });

  it("cover every navigation group and item", () => {
    for (const g of NAV_GROUPS) expect(de).toHaveProperty(`nav.group.${g}`);
    for (const i of NAV_ITEMS) expect(de).toHaveProperty(i.labelKey);
  });

  it("keep the local-only and stop wording", () => {
    expect(de["app.localOnly"]).toBe("Lokal · nicht in Odoo gebucht");
    expect(de["home.clarify"]).toBe("Stopp – Klärung");
  });
});

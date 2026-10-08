import { describe, expect, it } from "vitest";
import { NAV_GROUPS, NAV_ITEMS, navItemsFor } from "./navigation";

describe("navigation contract", () => {
  it("keeps the six work groups in fixed order", () => {
    expect(NAV_GROUPS).toEqual(["today", "production", "orderDelivery", "planningWarehouse", "coordination", "communication"]);
  });

  it("has unique paths and only known groups", () => {
    const paths = NAV_ITEMS.map((i) => i.path);
    expect(new Set(paths).size).toBe(paths.length);
    for (const item of NAV_ITEMS) expect(NAV_GROUPS).toContain(item.group);
  });

  it("gives every person the start page, workplace and communication", () => {
    const paths = navItemsFor([]).map((i) => i.path);
    expect(paths).toEqual(expect.arrayContaining(["/", "/arbeitsplatz", "/nachrichten", "/chat"]));
  });

  it("hides coordination pages from production staff", () => {
    const paths = navItemsFor(["production"]).map((i) => i.path);
    for (const p of ["/planung", "/team", "/personen", "/zustaendigkeiten", "/leitstand", "/pruefung"]) {
      expect(paths).not.toContain(p);
    }
  });

  it("shows coordination pages to coordinators", () => {
    const paths = navItemsFor(["coordinator"]).map((i) => i.path);
    expect(paths).toEqual(expect.arrayContaining(["/team", "/personen", "/zustaendigkeiten", "/leitstand", "/planung"]));
  });
});

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

  it("gives every role the start page", () => {
    expect(navItemsFor("employee").map((i) => i.path)).toContain("/");
    expect(navItemsFor("coordinator").map((i) => i.path)).toContain("/");
  });
});

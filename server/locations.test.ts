import { describe, expect, it } from "vitest";
import { qrPayload } from "@shared/locations";
import { teamHarness } from "./test/fixtures";

describe("local warehouse map", () => {
  it("builds the hierarchy and resolves QR/text codes per company", async () => {
    const t = await teamHarness();
    const coord = await t.h.as("coord");
    const jakub = await t.h.as("jakub");
    const pos = { x: 0, y: 0, w: 10, h: 10 };
    const { id: site } = await coord.api.locations.create(coord.m({ level: "site", parentId: null, code: "DE", name: "Deutschland", ...pos }));
    await expect(coord.api.locations.create(coord.m({ level: "rack", parentId: site, code: "R1", name: "Regal", ...pos }))).rejects.toMatchObject({
      message: "invalid_parent",
    });
    const { id: zone } = await coord.api.locations.create(coord.m({ level: "zone", parentId: site, code: "DE-A", name: "Zone A", ...pos }));
    await expect(coord.api.locations.create(coord.m({ level: "zone", parentId: site, code: "DE-A", name: "dup", ...pos }))).rejects.toMatchObject({
      message: "code_taken",
    });

    expect(await jakub.api.locations.lookup({ raw: "de-a" })).toEqual({ result: "found", id: zone });
    expect(await jakub.api.locations.lookup({ raw: qrPayload(1, "DE-A", 1) })).toEqual({ result: "found", id: zone });
    expect(await jakub.api.locations.lookup({ raw: qrPayload(2, "DE-A", 1) })).toEqual({ result: "not_found" });
    expect(await jakub.api.locations.lookup({ raw: "??" })).toEqual({ result: "invalid" });

    // Moving a location makes old QR labels stale.
    const rec = (await coord.api.locations.list()).find((l) => l.id === zone)!;
    await coord.api.locations.update(coord.m({ id: zone, version: rec.version, code: "DE-A", name: "Zone A", x: 20, y: 0, w: 10, h: 10, active: true }));
    expect(await jakub.api.locations.lookup({ raw: qrPayload(1, "DE-A", 1) })).toEqual({ result: "stale", id: zone });

    const rec2 = (await coord.api.locations.list()).find((l) => l.id === zone)!;
    await coord.api.locations.update(coord.m({ id: zone, version: rec2.version, code: "DE-A", name: "Zone A", x: 20, y: 0, w: 10, h: 10, active: false }));
    expect(await jakub.api.locations.lookup({ raw: "DE-A" })).toEqual({ result: "inactive", id: zone });

    // Other company sees nothing; the map never contains stock data.
    await coord.switchTo(2);
    expect(await coord.api.locations.list()).toEqual([]);
    const keys = Object.keys(rec2);
    for (const k of ["quantity", "lot", "stock", "reserved"]) expect(keys).not.toContain(k);
  });

  it("only coordinators edit the map", async () => {
    const t = await teamHarness();
    const jakub = await t.h.as("jakub");
    await expect(jakub.api.locations.create(jakub.m({ level: "site", parentId: null, code: "X", name: "x", x: 0, y: 0, w: 1, h: 1 }))).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});

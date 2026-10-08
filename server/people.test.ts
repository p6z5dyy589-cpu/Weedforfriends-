import { describe, expect, it } from "vitest";
import { teamHarness } from "./test/fixtures";

describe("people administration", () => {
  it("creates a person who can log in with the granted roles", async () => {
    const t = await teamHarness();
    const coord = await t.h.as("coord");
    await coord.api.people.create(coord.m({ loginName: "noemi", displayName: "Noemi", pin: "4711", roles: ["qm"] }));
    const noemi = await t.h.as("noemi", "4711");
    const me = await noemi.api.auth.me();
    expect(me.roles).toEqual(["qm"]);
    expect(me.companies.map((c) => c.id)).toEqual([1]);
    const history = t.h.store.events.filter((e) => e.subject === "person" && e.type === "created");
    expect(history).toHaveLength(1);
    expect(history[0]!.subjectId).toBe(String(me.id));
    expect(JSON.stringify(history)).not.toContain("4711");
  });

  it("rejects duplicate short names", async () => {
    const t = await teamHarness();
    const coord = await t.h.as("coord");
    await expect(coord.api.people.create(coord.m({ loginName: "JAKUB", displayName: "x", pin: "1111", roles: [] }))).rejects.toMatchObject({ message: "login_taken" });
  });

  it("a coordinator cannot remove their own coordinator role or themselves", async () => {
    const t = await teamHarness();
    const coord = await t.h.as("coord");
    await expect(coord.api.people.update(coord.m({ userId: t.ids.coord, displayName: "C", roles: ["planner"] }))).rejects.toMatchObject({
      message: "cannot_remove_own_coordinator",
    });
    await expect(coord.api.people.removeFromCompany(coord.m({ userId: t.ids.coord }))).rejects.toMatchObject({ message: "cannot_remove_self" });
  });

  it("cannot manage people of another company", async () => {
    const t = await teamHarness();
    const coord = await t.h.as("coord");
    await expect(coord.api.people.resetPin(coord.m({ userId: t.ids.xenon, pin: "9999" }))).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect((await coord.api.people.adminList()).map((p) => p.id)).not.toContain(t.ids.xenon);
  });

  it("removing from one company keeps the other and ends sessions", async () => {
    const t = await teamHarness();
    const both = await t.h.addUser({ loginName: "both", grants: [[1, ["production"]], [2, ["production"]]] });
    const session = await t.h.as("both");
    const coord = await t.h.as("coord");
    await coord.api.people.removeFromCompany(coord.m({ userId: both }));
    await expect(session.api.auth.me()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    const user = await t.h.store.findUserById(both);
    expect(user?.active).toBe(true);
    expect(user?.grants.map((g) => g.companyId)).toEqual([2]);
  });

  it("PIN reset ends sessions and the new PIN works", async () => {
    const t = await teamHarness();
    const jakub = await t.h.as("jakub");
    const coord = await t.h.as("coord");
    await coord.api.people.resetPin(coord.m({ userId: t.ids.jakub, pin: "5555" }));
    await expect(jakub.api.auth.me()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await t.h.as("jakub", "5555");
  });

  it("only coordinators manage people", async () => {
    const t = await teamHarness();
    const jakub = await t.h.as("jakub");
    await expect(jakub.api.people.adminList()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(jakub.api.people.create(jakub.m({ loginName: "evil", displayName: "x", pin: "1111", roles: ["coordinator"] }))).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});

import { describe, expect, it } from "vitest";
import { createHarness } from "./test/harness";

describe("company isolation", () => {
  it("switches only to companies granted on the server", async () => {
    const h = await createHarness();
    await h.addUser({ loginName: "ana", pin: "1234", grants: [[1, ["production"]]] });
    const c = h.client();
    await c.api.auth.login({ loginName: "ana", pin: "1234" });
    await expect(c.api.auth.switchCompany({ companyId: 2 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect((await c.api.auth.me()).activeCompanyId).toBe(1);
  });

  it("rejects unknown company ids", async () => {
    const h = await createHarness();
    await h.addUser({ loginName: "ana", pin: "1234", grants: [[1, ["production"]], [2, ["production"]]] });
    const c = h.client();
    await c.api.auth.login({ loginName: "ana", pin: "1234" });
    await expect(c.api.auth.switchCompany({ companyId: 3 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("binds the start page to the active session company", async () => {
    const h = await createHarness();
    await h.addUser({ loginName: "ana", pin: "1234", grants: [[1, ["production"]], [2, ["production"]]] });
    const c = h.client();
    await c.api.auth.login({ loginName: "ana", pin: "1234" });
    expect((await c.api.today.overview()).companyId).toBe(1);
    await c.api.auth.switchCompany({ companyId: 2 });
    expect((await c.api.today.overview()).companyId).toBe(2);
  });

  it("drops the session when the grant for the active company is revoked", async () => {
    const h = await createHarness();
    const id = await h.addUser({ loginName: "ana", pin: "1234", grants: [[1, ["production"]], [2, ["production"]]] });
    const c = h.client();
    await c.api.auth.login({ loginName: "ana", pin: "1234" });
    h.store.users.get(id)!.grants = [{ companyId: 2, roles: ["production"] }];
    await expect(c.api.today.overview()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("only lists granted companies", async () => {
    const h = await createHarness();
    await h.addUser({ loginName: "ana", pin: "1234", grants: [[2, ["production"]]] });
    const c = h.client();
    await c.api.auth.login({ loginName: "ana", pin: "1234" });
    expect((await c.api.auth.me()).companies).toEqual([{ id: 2, name: "Xenon" }]);
  });

  it("start page is empty until a real work source exists", async () => {
    const h = await createHarness();
    await h.addUser({ loginName: "ana", pin: "1234", grants: [[1, ["production"]]] });
    const c = h.client();
    await c.api.auth.login({ loginName: "ana", pin: "1234" });
    const o = await c.api.today.overview();
    expect(o.now).toBeNull();
    expect([o.next, o.waiting, o.labelsReady, o.clarify].every((l) => l.length === 0)).toBe(true);
  });
});

import { teamHarness } from "./test/fixtures";

describe("company isolation across modules (handbook 16.1)", () => {
  it("a stale screen of the previous company cannot act after a switch", async () => {
    const t = await teamHarness();
    const coord = await t.h.as("coord");
    const stale = coord.m({ processType: "general" as const, workType: null, reference: "X", product: "Y", quantity: null, unit: "pcs" as const, assigneeId: null, plannedDate: null });
    await coord.switchTo(2);
    await expect(coord.api.tasks.create(stale)).rejects.toMatchObject({ code: "CONFLICT", message: "company_changed" });
  });

  it("Solovya cannot read or change a Xenon task by id", async () => {
    const t = await teamHarness();
    const coord = await t.h.as("coord");
    await coord.switchTo(2);
    const { id } = await coord.api.tasks.create(
      coord.m({ processType: "production", workType: "flowers", reference: "X-1", product: "Xenon Haze", quantity: 1, unit: "g", assigneeId: t.ids.xenon, plannedDate: null }),
    );
    await coord.switchTo(1);
    await expect(coord.api.tasks.get({ id })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(coord.api.tasks.cancel(coord.m({ taskId: id, version: 1, note: "x" }))).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect((await coord.api.tasks.list({ scope: "team" })).map((r) => r.id)).not.toContain(id);
    expect((await coord.api.control.overview()).unassigned).toEqual([]);
  });

  it("Xenon worker cannot reach Solovya data and errors leak nothing", async () => {
    const t = await teamHarness();
    const coord = await t.h.as("coord");
    const xenon = await t.h.as("xenon");
    const { id } = await coord.api.tasks.create(
      coord.m({ processType: "production", workType: "flowers", reference: "SECRET-REF", product: "Geheim", quantity: 1, unit: "g", assigneeId: t.ids.jakub, plannedDate: null }),
    );
    const err = await xenon.api.tasks.get({ id }).catch((e: Error) => e);
    expect(err).toMatchObject({ code: "NOT_FOUND" });
    expect(JSON.stringify(err)).not.toMatch(/SECRET-REF|Geheim|JAKUB/);
    await expect(xenon.api.tasks.list({ scope: "mine" })).resolves.toEqual([]);
    // Only people granted for Xenon (the coordinator holds both companies).
    expect((await xenon.api.people.directory()).map((p) => p.id).sort()).toEqual([t.ids.coord, t.ids.xenon].sort());
  });

  it("request ids cannot be replayed by another person", async () => {
    const t = await teamHarness();
    const coord = await t.h.as("coord");
    const jakub = await t.h.as("jakub");
    const input = coord.m({ processType: "general" as const, workType: null, reference: "X", product: "Y", quantity: null, unit: "pcs" as const, assigneeId: null, plannedDate: null });
    await coord.api.tasks.create(input);
    await expect(jakub.api.chat.send({ ...input, target: { kind: "team" }, text: "hi" })).rejects.toMatchObject({ code: "CONFLICT", message: "request_reused" });
  });
});

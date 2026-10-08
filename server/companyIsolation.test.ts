import { describe, expect, it } from "vitest";
import { createHarness } from "./test/harness";

describe("company isolation", () => {
  it("switches only to companies granted on the server", async () => {
    const h = await createHarness();
    await h.addUser({ loginName: "ana", pin: "1234", companyIds: [1] });
    const c = h.client();
    await c.api.auth.login({ loginName: "ana", pin: "1234" });
    await expect(c.api.auth.switchCompany({ companyId: 2 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect((await c.api.auth.me()).activeCompanyId).toBe(1);
  });

  it("rejects unknown company ids", async () => {
    const h = await createHarness();
    await h.addUser({ loginName: "ana", pin: "1234", companyIds: [1, 2] });
    const c = h.client();
    await c.api.auth.login({ loginName: "ana", pin: "1234" });
    await expect(c.api.auth.switchCompany({ companyId: 3 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("binds the start page to the active session company", async () => {
    const h = await createHarness();
    await h.addUser({ loginName: "ana", pin: "1234", companyIds: [1, 2] });
    const c = h.client();
    await c.api.auth.login({ loginName: "ana", pin: "1234" });
    expect((await c.api.today.overview()).companyId).toBe(1);
    await c.api.auth.switchCompany({ companyId: 2 });
    expect((await c.api.today.overview()).companyId).toBe(2);
  });

  it("drops the session when the grant for the active company is revoked", async () => {
    const h = await createHarness();
    const id = await h.addUser({ loginName: "ana", pin: "1234", companyIds: [1, 2] });
    const c = h.client();
    await c.api.auth.login({ loginName: "ana", pin: "1234" });
    h.store.users.get(id)!.companyIds = [2];
    await expect(c.api.today.overview()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("only lists granted companies", async () => {
    const h = await createHarness();
    await h.addUser({ loginName: "ana", pin: "1234", companyIds: [2] });
    const c = h.client();
    await c.api.auth.login({ loginName: "ana", pin: "1234" });
    expect((await c.api.auth.me()).companies).toEqual([{ id: 2, name: "Xenon" }]);
  });

  it("start page is empty until a real work source exists", async () => {
    const h = await createHarness();
    await h.addUser({ loginName: "ana", pin: "1234", companyIds: [1] });
    const c = h.client();
    await c.api.auth.login({ loginName: "ana", pin: "1234" });
    const o = await c.api.today.overview();
    expect(o.now).toBeNull();
    expect([o.next, o.waiting, o.labelsReady, o.clarify].every((l) => l.length === 0)).toBe(true);
  });
});

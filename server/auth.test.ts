import { describe, expect, it } from "vitest";
import { createHarness } from "./test/harness";
import { SESSION_TTL_MS } from "./_core/context";
import { hashToken } from "./auth/pin";

describe("kiosk login", () => {
  it("logs in with correct PIN and returns the first granted company", async () => {
    const h = await createHarness();
    await h.addUser({ loginName: "ana", pin: "1234", grants: [[2, ["production"]], [1, ["production"]]] });
    const c = h.client();
    await c.api.auth.login({ loginName: "ana", pin: "1234" });
    expect(c.jar.token).toBeTruthy();
    const me = await c.api.auth.me();
    expect(me.activeCompanyId).toBe(2);
    expect(me).not.toHaveProperty("pinHash");
  });

  it("stores only the token hash, never the token", async () => {
    const h = await createHarness();
    await h.addUser({ loginName: "ana", pin: "1234", grants: [[1, ["production"]]] });
    const c = h.client();
    await c.api.auth.login({ loginName: "ana", pin: "1234" });
    expect(h.store.sessions.has(c.jar.token!)).toBe(false);
    expect(h.store.sessions.has(hashToken(c.jar.token!))).toBe(true);
  });

  it("gives the same error for wrong PIN, unknown user, inactive user and no company", async () => {
    const h = await createHarness();
    await h.addUser({ loginName: "ana", pin: "1234", grants: [[1, ["production"]]] });
    await h.addUser({ loginName: "old", pin: "1234", grants: [[1, ["production"]]], active: false });
    await h.addUser({ loginName: "none", pin: "1234", grants: [] });
    const cases = [
      { loginName: "ana", pin: "9999" },
      { loginName: "ghost", pin: "1234" },
      { loginName: "old", pin: "1234" },
      { loginName: "none", pin: "1234" },
    ];
    for (const input of cases) {
      const c = h.client(`ip-${input.loginName}`);
      await expect(c.api.auth.login(input)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
      expect(c.jar.token).toBeNull();
    }
  });

  it("blocks after repeated failures, even with the correct PIN", async () => {
    const h = await createHarness();
    await h.addUser({ loginName: "ana", pin: "1234", grants: [[1, ["production"]]] });
    const c = h.client();
    for (let i = 0; i < 3; i++) {
      await expect(c.api.auth.login({ loginName: "ana", pin: "0000" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    }
    await expect(c.api.auth.login({ loginName: "ana", pin: "1234" })).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
    h.advance(60_001);
    await c.api.auth.login({ loginName: "ana", pin: "1234" });
  });

  it("rejects malformed PIN input before touching the store", async () => {
    const h = await createHarness();
    const c = h.client();
    await expect(c.api.auth.login({ loginName: "ana", pin: "12ab" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("expires sessions and requires login without a cookie", async () => {
    const h = await createHarness();
    await h.addUser({ loginName: "ana", pin: "1234", grants: [[1, ["production"]]] });
    const c = h.client();
    await expect(c.api.auth.me()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await c.api.auth.login({ loginName: "ana", pin: "1234" });
    h.advance(SESSION_TTL_MS);
    await expect(c.api.auth.me()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(h.store.sessions.size).toBe(0);
  });

  it("invalidates the session when the user is deactivated", async () => {
    const h = await createHarness();
    const id = await h.addUser({ loginName: "ana", pin: "1234", grants: [[1, ["production"]]] });
    const c = h.client();
    await c.api.auth.login({ loginName: "ana", pin: "1234" });
    h.store.users.get(id)!.active = false;
    await expect(c.api.auth.me()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("logout deletes the session", async () => {
    const h = await createHarness();
    await h.addUser({ loginName: "ana", pin: "1234", grants: [[1, ["production"]]] });
    const c = h.client();
    await c.api.auth.login({ loginName: "ana", pin: "1234" });
    const token = c.jar.token!;
    await c.api.auth.logout();
    expect(c.jar.token).toBeNull();
    expect(h.store.sessions.has(hashToken(token))).toBe(false);
  });
});

import { randomUUID } from "node:crypto";
import type { CompanyId } from "@shared/companies";
import type { Role } from "@shared/roles";
import { appRouter } from "../routers";
import type { Context } from "../_core/context";
import { hashPin } from "../auth/pin";
import { AttemptLimiter } from "../auth/rateLimit";
import { MemoryStore } from "../store/memoryStore";
import { MemoryFileStore } from "../files/fileStore";

export type GrantSpec = [CompanyId, Role[]][];

export async function createHarness() {
  const store = new MemoryStore();
  const files = new MemoryFileStore();
  let now = new Date("2026-01-05T07:00:00Z");
  const limiter = new AttemptLimiter(3, 60_000, () => now.getTime());

  async function addUser(opts: { loginName: string; pin?: string; grants: GrantSpec; active?: boolean; displayName?: string }) {
    return store.addUser({
      loginName: opts.loginName,
      displayName: opts.displayName ?? opts.loginName.toUpperCase(),
      active: opts.active ?? true,
      pinHash: await hashPin(opts.pin ?? "1234"),
      grants: opts.grants.map(([companyId, roles]) => ({ companyId, roles })),
    });
  }

  /** A client with its own cookie jar, like one browser. */
  function client(clientKey = "10.0.0.1") {
    const jar: { token: string | null } = { token: null };
    const ctx = (): Context => ({
      store,
      files,
      limiter,
      clientKey,
      sessionToken: jar.token,
      setSessionCookie: (token) => {
        jar.token = token;
      },
      clearSessionCookie: () => {
        jar.token = null;
      },
      now: () => now,
      newId: () => randomUUID(),
    });
    return {
      jar,
      get api() {
        return appRouter.createCaller(ctx());
      },
    };
  }

  /** Logged-in client; m() adds requestId and the currently shown company. */
  async function as(loginName: string, pin = "1234") {
    const c = client(`ip-${loginName}`);
    await c.api.auth.login({ loginName, pin });
    const state = { companyId: (await c.api.auth.me()).activeCompanyId as number };
    return {
      ...c,
      get api() {
        return c.api;
      },
      state,
      m: <T extends object>(input: T) => ({ requestId: randomUUID(), companyId: state.companyId, ...input }),
      async switchTo(companyId: number) {
        await c.api.auth.switchCompany({ companyId });
        state.companyId = companyId;
      },
    };
  }

  return {
    store,
    files,
    addUser,
    client,
    as,
    advance: (ms: number) => {
      now = new Date(now.getTime() + ms);
    },
    setNow: (d: Date) => {
      now = d;
    },
  };
}

import type { CompanyId } from "@shared/companies";
import type { Role } from "@shared/roles";
import { appRouter } from "../routers";
import type { Context } from "../_core/context";
import { hashPin } from "../auth/pin";
import { AttemptLimiter } from "../auth/rateLimit";
import { MemoryAuthStore } from "../auth/store";

export async function createHarness() {
  const store = new MemoryAuthStore();
  let now = new Date("2026-01-05T07:00:00Z");
  const limiter = new AttemptLimiter(3, 60_000, () => now.getTime());
  let nextId = 1;

  async function addUser(opts: { loginName: string; pin: string; companyIds: CompanyId[]; role?: Role; active?: boolean }) {
    const id = nextId++;
    store.users.set(id, {
      id,
      loginName: opts.loginName,
      displayName: `User ${id}`,
      role: opts.role ?? "employee",
      active: opts.active ?? true,
      pinHash: await hashPin(opts.pin),
      companyIds: opts.companyIds,
    });
    return id;
  }

  /** A client with its own cookie jar, like one browser. */
  function client(clientKey = "10.0.0.1") {
    const jar: { token: string | null } = { token: null };
    const ctx = (): Context => ({
      store,
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
    });
    return {
      jar,
      // Fresh caller per call so cookie changes are picked up.
      get api() {
        return appRouter.createCaller(ctx());
      },
    };
  }

  return {
    store,
    addUser,
    client,
    advance: (ms: number) => {
      now = new Date(now.getTime() + ms);
    },
  };
}

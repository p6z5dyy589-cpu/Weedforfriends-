import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { Role } from "@shared/roles";
import type { CompanyId } from "@shared/companies";
import type { KioskUser } from "../store/types";
import type { Context } from "./context";
import { hashToken } from "../auth/pin";

const t = initTRPC.context<Context>().create({ transformer: superjson });

export const router = t.router;
export const publicProcedure = t.procedure;

export interface KioskAuth {
  tokenHash: string;
  user: KioskUser;
  companyId: CompanyId;
  roles: Role[];
}

/**
 * Resolves the personal kiosk session. The active company is always taken
 * from the server-side session and re-checked against the user's company
 * grants - never from browser input.
 */
export async function resolveKiosk(ctx: Context): Promise<KioskAuth | null> {
  if (!ctx.sessionToken) return null;
  const tokenHash = hashToken(ctx.sessionToken);
  const session = await ctx.store.findSession(tokenHash);
  if (!session || session.expiresAt <= ctx.now()) {
    if (session) await ctx.store.deleteSession(tokenHash);
    return null;
  }
  const user = await ctx.store.findUserById(session.userId);
  const grant = user?.grants.find((g) => g.companyId === session.activeCompanyId);
  if (!user || !user.active || !grant) {
    await ctx.store.deleteSession(tokenHash);
    return null;
  }
  return { tokenHash, user, companyId: session.activeCompanyId, roles: grant.roles };
}

export const kioskProcedure = t.procedure.use(async ({ ctx, next }) => {
  const auth = await resolveKiosk(ctx);
  if (!auth) throw new TRPCError({ code: "UNAUTHORIZED" });
  return next({ ctx: { ...ctx, ...auth } });
});

/** Allows the call if the user holds at least one of the roles in the active company. */
export function roleProcedure(...roles: Role[]) {
  return kioskProcedure.use(({ ctx, next }) => {
    if (!roles.some((r) => ctx.roles.includes(r))) throw new TRPCError({ code: "FORBIDDEN" });
    return next();
  });
}

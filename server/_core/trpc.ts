import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { Context } from "./context";
import { hashToken } from "../auth/pin";

const t = initTRPC.context<Context>().create({ transformer: superjson });

export const router = t.router;
export const publicProcedure = t.procedure;

/**
 * Requires a valid personal kiosk session. The active company is always taken
 * from the server-side session and re-checked against the user's company
 * grants - never from browser input.
 */
export const kioskProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.sessionToken) throw new TRPCError({ code: "UNAUTHORIZED" });
  const tokenHash = hashToken(ctx.sessionToken);
  const session = await ctx.store.findSession(tokenHash);
  if (!session || session.expiresAt <= ctx.now()) {
    if (session) await ctx.store.deleteSession(tokenHash);
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  const user = await ctx.store.findUserById(session.userId);
  if (!user || !user.active || !user.companyIds.includes(session.activeCompanyId)) {
    await ctx.store.deleteSession(tokenHash);
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: { ...ctx, tokenHash, user, companyId: session.activeCompanyId },
  });
});

export const coordinatorProcedure = kioskProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "coordinator") throw new TRPCError({ code: "FORBIDDEN" });
  return next();
});

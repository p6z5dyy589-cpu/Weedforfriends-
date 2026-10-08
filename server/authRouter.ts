import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { COMPANIES, isCompanyId } from "@shared/companies";
import { router, publicProcedure, kioskProcedure } from "./_core/trpc";
import { SESSION_TTL_MS } from "./_core/context";
import { hashToken, newSessionToken, verifyPin, PIN_PATTERN } from "./auth/pin";

const loginInput = z.object({
  loginName: z.string().trim().min(1).max(64),
  pin: z.string().regex(PIN_PATTERN),
});

export const authRouter = router({
  login: publicProcedure.input(loginInput).mutation(async ({ ctx, input }) => {
    const limitKey = `${ctx.clientKey}|${input.loginName.toLowerCase()}`;
    if (ctx.limiter.isBlocked(limitKey)) {
      throw new TRPCError({ code: "TOO_MANY_REQUESTS" });
    }
    const user = await ctx.store.findUserByLoginName(input.loginName);
    const ok = user !== null && user.active && (await verifyPin(input.pin, user.pinHash));
    const firstCompany = user?.companyIds[0];
    if (!ok || firstCompany === undefined) {
      ctx.limiter.recordFailure(limitKey);
      // Same error for unknown user, wrong PIN, inactive or no company grant.
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }
    ctx.limiter.reset(limitKey);
    const token = newSessionToken();
    const expiresAt = new Date(ctx.now().getTime() + SESSION_TTL_MS);
    await ctx.store.createSession({
      tokenHash: hashToken(token),
      userId: user.id,
      activeCompanyId: firstCompany,
      expiresAt,
    });
    ctx.setSessionCookie(token, expiresAt);
    return { ok: true as const };
  }),

  logout: publicProcedure.mutation(async ({ ctx }) => {
    if (ctx.sessionToken) await ctx.store.deleteSession(hashToken(ctx.sessionToken));
    ctx.clearSessionCookie();
    return { ok: true as const };
  }),

  me: kioskProcedure.query(({ ctx }) => ({
    displayName: ctx.user.displayName,
    role: ctx.user.role,
    activeCompanyId: ctx.companyId,
    companies: COMPANIES.filter((c) => ctx.user.companyIds.includes(c.id)).map((c) => ({
      id: c.id,
      name: c.name,
    })),
  })),

  switchCompany: kioskProcedure
    .input(z.object({ companyId: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      if (!isCompanyId(input.companyId) || !ctx.user.companyIds.includes(input.companyId)) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      await ctx.store.updateSessionCompany(ctx.tokenHash, input.companyId);
      return { activeCompanyId: input.companyId };
    }),
});

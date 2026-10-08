import { z } from "zod";
import { ROLES } from "@shared/roles";
import type { PersonSummary } from "@shared/people";
import { router, kioskProcedure, roleProcedure } from "./_core/trpc";
import { mutationBase, notFound, runMutation, stop } from "./_core/mutation";
import { hashPin, PIN_PATTERN } from "./auth/pin";
import { NEW_USER_ID } from "./store/types";
import { companyPeople, rolesIn } from "./domain/people";

const roleList = z.array(z.enum(ROLES)).max(ROLES.length).transform((r) => [...new Set(r)]);
const loginName = z.string().trim().min(2).max(32).regex(/^[a-zA-Z0-9._-]+$/);
const displayName = z.string().trim().min(1).max(64);

export const peopleRouter = router({
  /** Names of active colleagues in the active company (for assignment, chat). */
  directory: kioskProcedure.query(async ({ ctx }): Promise<PersonSummary[]> => {
    const people = await companyPeople(ctx.store, ctx.companyId);
    return people
      .map((u) => ({ id: u.id, displayName: u.displayName, loginName: u.loginName, roles: rolesIn(u, ctx.companyId) }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  }),

  adminList: roleProcedure("coordinator").query(async ({ ctx }) => {
    const people = await ctx.store.listUsersForCompany(ctx.companyId);
    return people
      .map((u) => ({
        id: u.id,
        loginName: u.loginName,
        displayName: u.displayName,
        active: u.active,
        roles: rolesIn(u, ctx.companyId),
        otherCompanies: u.grants.length > 1,
      }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  }),

  create: roleProcedure("coordinator")
    .input(mutationBase.extend({ loginName, displayName, pin: z.string().regex(PIN_PATTERN), roles: roleList }))
    .mutation(async ({ ctx, input }) =>
      runMutation(ctx, input, "people.create", async (m) => {
        const pinHash = await hashPin(input.pin);
        m.event("person", NEW_USER_ID, "created", { roles: input.roles });
        return {
          users: [{ type: "create", loginName: input.loginName, displayName: input.displayName, pinHash, grants: [{ companyId: ctx.companyId, roles: input.roles }] }],
          result: (out) => ({ id: out.newUserId! }),
        };
      }),
    ),

  update: roleProcedure("coordinator")
    .input(mutationBase.extend({ userId: z.number().int(), displayName, roles: roleList }))
    .mutation(async ({ ctx, input }) =>
      runMutation(ctx, input, "people.update", async (m) => {
        const target = await ctx.store.findUserById(input.userId);
        if (!target || !target.grants.some((g) => g.companyId === ctx.companyId)) notFound();
        if (target.id === ctx.user.id && !input.roles.includes("coordinator")) stop("cannot_remove_own_coordinator");
        m.event("person", String(target.id), "updated", { roles: input.roles, nameChanged: target.displayName !== input.displayName });
        return {
          users: [
            { type: "update", userId: target.id, displayName: input.displayName },
            { type: "setGrant", userId: target.id, companyId: ctx.companyId, roles: input.roles },
          ],
          result: { ok: true as const },
        };
      }),
    ),

  resetPin: roleProcedure("coordinator")
    .input(mutationBase.extend({ userId: z.number().int(), pin: z.string().regex(PIN_PATTERN) }))
    .mutation(async ({ ctx, input }) =>
      runMutation(ctx, input, "people.resetPin", async (m) => {
        const target = await ctx.store.findUserById(input.userId);
        if (!target || !target.grants.some((g) => g.companyId === ctx.companyId)) notFound();
        m.event("person", String(target.id), "pin_reset");
        return {
          users: [
            { type: "update", userId: target.id, pinHash: await hashPin(input.pin) },
            { type: "deleteSessions", userId: target.id },
          ],
          result: { ok: true as const },
        };
      }),
    ),

  /** Removes the person from the active company only; other companies stay untouched. */
  removeFromCompany: roleProcedure("coordinator")
    .input(mutationBase.extend({ userId: z.number().int() }))
    .mutation(async ({ ctx, input }) =>
      runMutation(ctx, input, "people.removeFromCompany", async (m) => {
        const target = await ctx.store.findUserById(input.userId);
        if (!target || !target.grants.some((g) => g.companyId === ctx.companyId)) notFound();
        if (target.id === ctx.user.id) stop("cannot_remove_self");
        const lastGrant = target.grants.length === 1;
        m.event("person", String(target.id), "removed_from_company", { deactivated: lastGrant });
        return {
          users: [
            { type: "setGrant", userId: target.id, companyId: ctx.companyId, roles: null },
            ...(lastGrant ? [{ type: "update" as const, userId: target.id, active: false }] : []),
            { type: "deleteSessions", userId: target.id },
          ],
          result: { ok: true as const },
        };
      }),
    ),
});

import { z } from "zod";
import { LOCATION_CODE, LOCATION_LEVELS, parseScan, validParent, type LocationData } from "@shared/locations";
import { router, kioskProcedure, roleProcedure } from "./_core/trpc";
import { mutationBase, notFound, runMutation, stop } from "./_core/mutation";
import { TRPCError } from "@trpc/server";

const grid = z.number().int().min(0).max(99);
const size = z.number().int().min(1).max(100);
const fields = z.object({
  code: z.string().trim().toUpperCase().regex(LOCATION_CODE),
  name: z.string().trim().min(1).max(80),
  x: grid,
  y: grid,
  w: size,
  h: size,
});

/**
 * Local warehouse map: structure and orientation only. Never stock, lots,
 * reservations or Odoo location moves.
 */
export const locationsRouter = router({
  list: kioskProcedure.query(async ({ ctx }) => {
    const recs = await ctx.store.listRecords<LocationData>(ctx.companyId, "location");
    return recs.map((r) => ({ id: r.id, version: r.version, ...r.data }));
  }),

  create: roleProcedure("coordinator")
    .input(mutationBase.extend({ level: z.enum(LOCATION_LEVELS), parentId: z.string().min(1).max(64).nullable() }).merge(fields))
    .mutation(async ({ ctx, input }) => {
      const all = await ctx.store.listRecords<LocationData>(ctx.companyId, "location");
      const parent = input.parentId ? all.find((r) => r.id === input.parentId) : null;
      if (input.parentId && !parent) notFound();
      if (!validParent(input.level, parent?.data.level ?? null)) stop("invalid_parent");
      if (all.some((r) => r.data.code === input.code)) stop("code_taken");
      return runMutation(ctx, input, "locations.create", async (m) => {
        const data: LocationData = {
          level: input.level,
          parentId: input.parentId,
          code: input.code,
          name: input.name,
          x: input.x,
          y: input.y,
          w: input.w,
          h: input.h,
          active: true,
          layoutVersion: 1,
        };
        const rec = m.newRecord("location", data, { parentId: input.parentId });
        m.event("location", rec.id, "location_created", { code: data.code, level: data.level });
        return { creates: [rec], result: { id: rec.id } };
      });
    }),

  update: roleProcedure("coordinator")
    .input(mutationBase.extend({ id: z.string().min(1).max(64), version: z.number().int(), active: z.boolean() }).merge(fields))
    .mutation(async ({ ctx, input }) => {
      const all = await ctx.store.listRecords<LocationData>(ctx.companyId, "location");
      const rec = all.find((r) => r.id === input.id);
      if (!rec) notFound();
      if (rec.version !== input.version) throw new TRPCError({ code: "CONFLICT", message: "version" });
      if (all.some((r) => r.id !== rec.id && r.data.code === input.code)) stop("code_taken");
      const moved = rec.data.code !== input.code || rec.data.x !== input.x || rec.data.y !== input.y || rec.data.w !== input.w || rec.data.h !== input.h;
      return runMutation(ctx, input, "locations.update", async (m) => {
        const data: LocationData = {
          ...rec.data,
          code: input.code,
          name: input.name,
          x: input.x,
          y: input.y,
          w: input.w,
          h: input.h,
          active: input.active,
          layoutVersion: rec.data.layoutVersion + (moved ? 1 : 0),
        };
        m.event("location", rec.id, "location_updated", { code: data.code, active: data.active, layoutVersion: data.layoutVersion });
        return { updates: [m.change(rec, data)], result: { ok: true as const } };
      });
    }),

  /** Scanner/text lookup: company, active state and layout version are checked on the server. */
  lookup: kioskProcedure.input(z.object({ raw: z.string().max(120) })).query(async ({ ctx, input }) => {
    const scan = parseScan(input.raw);
    if (!scan) return { result: "invalid" as const };
    // A code of another company answers like an unknown code.
    if (scan.kind === "qr" && scan.companyId !== ctx.companyId) return { result: "not_found" as const };
    const all = await ctx.store.listRecords<LocationData>(ctx.companyId, "location");
    const rec = all.find((r) => r.data.code === scan.code);
    if (!rec) return { result: "not_found" as const };
    if (!rec.data.active) return { result: "inactive" as const, id: rec.id };
    if (scan.kind === "qr" && scan.layoutVersion !== rec.data.layoutVersion) return { result: "stale" as const, id: rec.id };
    return { result: "found" as const, id: rec.id };
  }),
});

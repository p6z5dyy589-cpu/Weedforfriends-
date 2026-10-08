import { z } from "zod";
import type { NotificationData } from "@shared/notifications";
import { router, kioskProcedure } from "./_core/trpc";
import { mutationBase, runMutation } from "./_core/mutation";
import { companyPeople } from "./domain/people";

export const notificationsRouter = router({
  list: kioskProcedure.query(async ({ ctx }) => {
    const recs = await ctx.store.listRecords<NotificationData>(ctx.companyId, "notification", { ownerUserId: ctx.user.id, order: "desc", limit: 100 });
    const names = new Map((await companyPeople(ctx.store, ctx.companyId)).map((u) => [u.id, u.displayName]));
    return recs.map((r) => ({
      id: r.id,
      version: r.version,
      type: r.data.type,
      taskId: r.data.taskId,
      conversationId: r.data.conversationId,
      actorName: names.get(r.data.actorId) ?? null,
      read: r.data.readAt !== null,
      at: r.createdAt,
    }));
  }),

  unreadCount: kioskProcedure.query(async ({ ctx }) => {
    const recs = await ctx.store.listRecords<NotificationData>(ctx.companyId, "notification", { ownerUserId: ctx.user.id, order: "desc", limit: 500 });
    return recs.filter((r) => r.data.readAt === null).length;
  }),

  markRead: kioskProcedure
    .input(mutationBase.extend({ ids: z.array(z.string().min(1).max(64)).max(500).nullable() }))
    .mutation(({ ctx, input }) =>
      runMutation(ctx, input, "notifications.markRead", async (m) => {
        const recs = await ctx.store.listRecords<NotificationData>(ctx.companyId, "notification", { ownerUserId: ctx.user.id, order: "desc", limit: 500 });
        const wanted = input.ids ? new Set(input.ids) : null;
        const at = ctx.now().toISOString();
        const updates = recs
          .filter((r) => r.data.readAt === null && (!wanted || wanted.has(r.id)))
          .map((r) => m.change(r, { ...r.data, readAt: at }));
        return { updates, result: { marked: updates.length } };
      }),
    ),
});

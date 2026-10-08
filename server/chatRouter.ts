import { z } from "zod";
import { TRPCError } from "@trpc/server";
import type { CompanyId } from "@shared/companies";
import { MAX_MESSAGE_LENGTH, extractMentions, type ChatMessageData, type ChatReadData, type ConversationData } from "@shared/chat";
import type { TaskData } from "@shared/tasks";
import { router, kioskProcedure } from "./_core/trpc";
import { mutationBase, notFound, runMutation, type MutationCtx } from "./_core/mutation";
import { loadTask } from "./domain/tasks";
import { companyPeople, personInCompany } from "./domain/people";
import { notify } from "./domain/notify";
import type { LocalRecord } from "./store/types";

export const teamId = (c: CompanyId) => `${c}:team`;
export const directId = (c: CompanyId, a: number, b: number) => `${c}:dm:${Math.min(a, b)}:${Math.max(a, b)}`;
export const taskChatId = (c: CompanyId, taskId: string) => `${c}:task:${taskId}`;
const readId = (conversationId: string, userId: number) => `${conversationId}:r:${userId}`;

type Target = { kind: "team" } | { kind: "direct"; userId: number } | { kind: "task"; taskId: string } | { kind: "id"; id: string };

/**
 * Resolves (and authorises) a conversation. Returns the id and, if it does
 * not exist yet, the data to create it. Foreign or forbidden conversations
 * answer NOT_FOUND.
 */
async function resolveConversation(ctx: MutationCtx, target: Target): Promise<{ id: string; data: ConversationData; existing: LocalRecord<ConversationData> | null }> {
  const c = ctx.companyId;
  if (target.kind === "id") {
    const rec = await ctx.store.getRecord<ConversationData>(c, "conversation", target.id);
    if (rec) {
      await assertAccess(ctx, rec.data);
      return { id: rec.id, data: rec.data, existing: rec };
    }
    if (target.id === teamId(c)) return resolveConversation(ctx, { kind: "team" });
    notFound();
  }
  let id: string;
  let data: ConversationData;
  if (target.kind === "team") {
    id = teamId(c);
    data = { type: "team", memberIds: [], taskId: null };
  } else if (target.kind === "direct") {
    if (target.userId === ctx.user.id || !(await personInCompany(ctx.store, c, target.userId))) notFound();
    id = directId(c, ctx.user.id, target.userId);
    data = { type: "direct", memberIds: [Math.min(ctx.user.id, target.userId), Math.max(ctx.user.id, target.userId)], taskId: null };
  } else {
    id = taskChatId(c, target.taskId);
    data = { type: "task", memberIds: [], taskId: target.taskId };
  }
  await assertAccess(ctx, data);
  const existing = await ctx.store.getRecord<ConversationData>(c, "conversation", id);
  return { id, data, existing };
}

async function assertAccess(ctx: MutationCtx, data: ConversationData) {
  if (data.type === "team") return;
  if (data.type === "direct") {
    if (!data.memberIds.includes(ctx.user.id)) notFound();
    return;
  }
  await loadTask(ctx.store, ctx.companyId, data.taskId!, { userId: ctx.user.id, roles: ctx.roles });
}

const targetSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("team") }),
  z.object({ kind: z.literal("direct"), userId: z.number().int() }),
  z.object({ kind: z.literal("task"), taskId: z.string().min(1).max(40) }),
  z.object({ kind: z.literal("id"), id: z.string().min(1).max(64) }),
]);

async function readMarker(ctx: MutationCtx, conversationId: string, userId: number) {
  return ctx.store.getRecord<ChatReadData>(ctx.companyId, "chatRead", readId(conversationId, userId));
}

export const chatRouter = router({
  conversations: kioskProcedure.query(async ({ ctx }) => {
    const all = await ctx.store.listRecords<ConversationData>(ctx.companyId, "conversation");
    const visible: LocalRecord<ConversationData>[] = [];
    for (const conv of all) {
      try {
        await assertAccess(ctx, conv.data);
        visible.push(conv);
      } catch {
        // not accessible - skip silently
      }
    }
    const people = new Map((await companyPeople(ctx.store, ctx.companyId)).map((u) => [u.id, u.displayName]));
    const rows = await Promise.all(
      visible.map(async (conv) => {
        const msgs = await ctx.store.listRecords<ChatMessageData>(ctx.companyId, "chatMessage", { parentId: conv.id });
        const marker = await readMarker(ctx, conv.id, ctx.user.id);
        const lastRead = marker ? new Date(marker.data.lastReadAt) : new Date(0);
        const last = msgs[msgs.length - 1];
        let title: string | null = null;
        if (conv.data.type === "direct") title = people.get(conv.data.memberIds.find((id) => id !== ctx.user.id) ?? -1) ?? null;
        if (conv.data.type === "task") {
          const t = await ctx.store.getRecord<TaskData>(ctx.companyId, "task", conv.data.taskId!);
          title = t ? `${t.data.reference} · ${t.data.product}` : null;
        }
        return {
          id: conv.id,
          type: conv.data.type,
          taskId: conv.data.taskId,
          title,
          lastAt: last?.createdAt ?? conv.createdAt,
          lastText: last ? last.data.text.slice(0, 80) : null,
          unread: msgs.filter((m) => m.data.authorId !== ctx.user.id && m.createdAt > lastRead).length,
        };
      }),
    );
    if (!rows.some((r) => r.type === "team")) {
      rows.push({ id: teamId(ctx.companyId), type: "team", taskId: null, title: null, lastAt: new Date(0), lastText: null, unread: 0 });
    }
    return rows.sort((a, b) => (a.type === "team" ? -1 : b.type === "team" ? 1 : b.lastAt.getTime() - a.lastAt.getTime()));
  }),

  unreadTotal: kioskProcedure.query(async ({ ctx }) => {
    const all = await ctx.store.listRecords<ConversationData>(ctx.companyId, "conversation");
    let total = 0;
    for (const conv of all) {
      try {
        await assertAccess(ctx, conv.data);
      } catch {
        continue;
      }
      const marker = await readMarker(ctx, conv.id, ctx.user.id);
      const lastRead = marker ? new Date(marker.data.lastReadAt) : new Date(0);
      const msgs = await ctx.store.listRecords<ChatMessageData>(ctx.companyId, "chatMessage", { parentId: conv.id });
      total += msgs.filter((m) => m.data.authorId !== ctx.user.id && m.createdAt > lastRead).length;
    }
    return total;
  }),

  /** Opens a conversation without creating it (no write on read). */
  open: kioskProcedure.input(z.object({ target: targetSchema })).query(async ({ ctx, input }) => {
    const { id, data, existing } = await resolveConversation(ctx, input.target);
    const people = await companyPeople(ctx.store, ctx.companyId);
    const names = new Map(people.map((u) => [u.id, u.displayName]));
    const msgs = existing ? await ctx.store.listRecords<ChatMessageData>(ctx.companyId, "chatMessage", { parentId: id, order: "desc", limit: 100 }) : [];
    msgs.reverse();
    // Read status: when did the others last read?
    let othersReadAt: Date | null = null;
    if (data.type === "direct") {
      const other = data.memberIds.find((m) => m !== ctx.user.id)!;
      const marker = await readMarker(ctx, id, other);
      othersReadAt = marker ? new Date(marker.data.lastReadAt) : null;
    }
    let title: string | null = null;
    if (data.type === "direct") title = names.get(data.memberIds.find((m) => m !== ctx.user.id)!) ?? null;
    if (data.type === "task") {
      const t = await ctx.store.getRecord<TaskData>(ctx.companyId, "task", data.taskId!);
      title = t ? `${t.data.reference} · ${t.data.product}` : null;
    }
    return {
      id,
      type: data.type,
      taskId: data.taskId,
      title,
      messages: msgs.map((m) => ({
        id: m.id,
        authorId: m.data.authorId,
        authorName: names.get(m.data.authorId) ?? null,
        text: m.data.text,
        at: m.createdAt,
        mine: m.data.authorId === ctx.user.id,
        readByOther: othersReadAt !== null && m.createdAt <= othersReadAt,
      })),
    };
  }),

  send: kioskProcedure
    .input(mutationBase.extend({ target: targetSchema, text: z.string().trim().min(1).max(MAX_MESSAGE_LENGTH) }))
    .mutation(async ({ ctx, input }) => {
      const conv = await resolveConversation(ctx, input.target);
      const people = await companyPeople(ctx.store, ctx.companyId);
      let mentionIds = extractMentions(input.text, people).filter((id) => id !== ctx.user.id);
      if (conv.data.type === "direct") mentionIds = mentionIds.filter((id) => conv.data.memberIds.includes(id));
      if (conv.data.type === "task") {
        // Mentions only notify people who may see the task.
        const allowed: number[] = [];
        for (const id of mentionIds) {
          const p = people.find((x) => x.id === id)!;
          const roles = p.grants.find((g) => g.companyId === ctx.companyId)?.roles ?? [];
          try {
            await loadTask(ctx.store, ctx.companyId, conv.data.taskId!, { userId: id, roles });
            allowed.push(id);
          } catch {
            // not visible for this person
          }
        }
        mentionIds = allowed;
      }
      return runMutation(ctx, input, "chat.send", async (m) => {
        const creates: LocalRecord[] = [];
        if (!conv.existing) creates.push(m.newRecord<ConversationData>("conversation", conv.data, { id: conv.id }));
        const msg = m.newRecord<ChatMessageData>("chatMessage", { authorId: ctx.user.id, text: input.text, mentionIds }, { parentId: conv.id });
        creates.push(msg);
        creates.push(...notify(m, ctx.user.id, mentionIds, "chat_mention", { conversationId: conv.id }));
        if (conv.data.type === "direct") {
          const other = conv.data.memberIds.filter((id) => !mentionIds.includes(id));
          creates.push(...notify(m, ctx.user.id, other, "direct_message", { conversationId: conv.id }));
        }
        m.event("conversation", conv.id, "message_sent", { mentions: mentionIds.length });
        return { creates, result: { conversationId: conv.id, messageId: msg.id } };
      });
    }),

  markRead: kioskProcedure.input(mutationBase.extend({ conversationId: z.string().min(1).max(64) })).mutation(async ({ ctx, input }) => {
    const conv = await resolveConversation(ctx, { kind: "id", id: input.conversationId });
    if (!conv.existing) return { ok: true as const };
    return runMutation(ctx, input, "chat.markRead", async (m) => {
      const id = readId(conv.id, ctx.user.id);
      const existing = await ctx.store.getRecord<ChatReadData>(ctx.companyId, "chatRead", id);
      const data: ChatReadData = { userId: ctx.user.id, conversationId: conv.id, lastReadAt: ctx.now().toISOString() };
      if (existing) return { updates: [m.change(existing, data)], result: { ok: true as const } };
      return { creates: [m.newRecord("chatRead", data, { id, ownerUserId: ctx.user.id, parentId: conv.id })], result: { ok: true as const } };
    });
  }),
});

export { TRPCError };

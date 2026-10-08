import type { TaskData } from "@shared/tasks";
import type { AttendanceData } from "@shared/coordination";
import { router, roleProcedure } from "./_core/trpc";
import { companyPeople } from "./domain/people";
import { plantDate } from "./domain/today";

/** Vincent/coordination overview: who needs a decision, and why. */
export const controlRouter = router({
  overview: roleProcedure("coordinator", "reviewer", "planner").query(async ({ ctx }) => {
    const today = plantDate(ctx.now());
    const tasks = await ctx.store.listRecords<TaskData>(ctx.companyId, "task");
    const people = await companyPeople(ctx.store, ctx.companyId);
    const names = new Map(people.map((p) => [p.id, p.displayName]));
    const card = (r: (typeof tasks)[number]) => ({
      id: r.id,
      reference: r.data.reference,
      product: r.data.product,
      status: r.data.status,
      processType: r.data.processType,
      assigneeName: r.data.assigneeId ? (names.get(r.data.assigneeId) ?? null) : null,
      blockReason: r.data.blocker?.reason ?? null,
      since: r.updatedAt,
    });
    const by = (pred: (t: TaskData) => boolean) => tasks.filter((r) => pred(r.data)).sort((a, b) => a.updatedAt.getTime() - b.updatedAt.getTime());

    let unknownAttendance = 0;
    let absent = 0;
    for (const p of people) {
      const rec = await ctx.store.getRecord<AttendanceData>(ctx.companyId, "attendance", `${ctx.companyId}:att:${today}:${p.id}`);
      if (!rec || rec.data.status === "unknown") unknownAttendance++;
      else if (rec.data.status === "absent") absent++;
    }
    const review = by((t) => t.status === "review");
    const blocked = by((t) => t.status === "blocked");
    const handovers = by((t) => t.status === "handover_offered");
    const unassigned = by((t) => t.status === "open" && t.assigneeId === null);
    return {
      date: today,
      counts: {
        review: review.length,
        blocked: blocked.length,
        handovers: handovers.length,
        unassigned: unassigned.length,
        inProgress: tasks.filter((r) => r.data.status === "in_progress" || r.data.status === "packing").length,
        unknownAttendance,
        absent,
      },
      review: review.slice(0, 20).map(card),
      blocked: blocked.slice(0, 20).map(card),
      handovers: handovers.slice(0, 20).map(card),
      unassigned: unassigned.slice(0, 20).map(card),
    };
  }),
});

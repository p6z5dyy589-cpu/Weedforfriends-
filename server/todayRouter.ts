import type { TaskData } from "@shared/tasks";
import type { TodayOverview } from "@shared/today";
import { router, kioskProcedure } from "./_core/trpc";
import { buildToday, plantDate } from "./domain/today";
import { companyPeople } from "./domain/people";

export const todayRouter = router({
  overview: kioskProcedure.query(async ({ ctx }): Promise<TodayOverview> => {
    const tasks = await ctx.store.listRecords<TaskData>(ctx.companyId, "task");
    const names = new Map((await companyPeople(ctx.store, ctx.companyId)).map((u) => [u.id, u.displayName]));
    return buildToday({ companyId: ctx.companyId, userId: ctx.user.id, roles: ctx.roles, tasks, names, today: plantDate(ctx.now()) });
  }),
});

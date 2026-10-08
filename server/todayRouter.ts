import type { TodayOverview } from "@shared/today";
import { router, kioskProcedure } from "./_core/trpc";

/**
 * Start page hierarchy. No work source is connected yet (the local
 * workplace follows as its own package), so the overview is honestly empty
 * instead of showing invented work.
 */
export const todayRouter = router({
  overview: kioskProcedure.query(({ ctx }): TodayOverview => ({
    companyId: ctx.companyId,
    now: null,
    next: [],
    waiting: [],
    labelsReady: [],
    clarify: [],
  })),
});

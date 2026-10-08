import { router } from "./_core/trpc";
import { authRouter } from "./authRouter";
import { todayRouter } from "./todayRouter";

export const appRouter = router({
  auth: authRouter,
  today: todayRouter,
});

export type AppRouter = typeof appRouter;

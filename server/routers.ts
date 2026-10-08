import { router } from "./_core/trpc";
import { authRouter } from "./authRouter";
import { todayRouter } from "./todayRouter";
import { peopleRouter } from "./peopleRouter";
import { tasksRouter } from "./tasksRouter";
import { coordinationRouter } from "./coordinationRouter";
import { notificationsRouter } from "./notificationsRouter";
import { chatRouter } from "./chatRouter";
import { locationsRouter } from "./locationsRouter";
import { controlRouter } from "./controlRouter";

export const appRouter = router({
  auth: authRouter,
  today: todayRouter,
  people: peopleRouter,
  tasks: tasksRouter,
  coordination: coordinationRouter,
  notifications: notificationsRouter,
  chat: chatRouter,
  locations: locationsRouter,
  control: controlRouter,
});

export type AppRouter = typeof appRouter;

import { randomUUID } from "node:crypto";
import express from "express";
import cookieParser from "cookie-parser";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "./routers";
import { SESSION_COOKIE, type Context } from "./_core/context";
import { AttemptLimiter } from "./auth/rateLimit";
import type { Store } from "./store/types";
import type { FileStore } from "./files/fileStore";
import { createFileRoutes } from "./files/fileRoutes";

export function createApp(store: Store, files: FileStore) {
  const app = express();
  const limiter = new AttemptLimiter();
  const secure = process.env.NODE_ENV === "production";

  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(cookieParser());

  const contextFor = (req: express.Request, res: express.Response): Context => ({
    store,
    files,
    limiter,
    clientKey: req.ip ?? "unknown",
    sessionToken: typeof req.cookies?.[SESSION_COOKIE] === "string" ? req.cookies[SESSION_COOKIE] : null,
    setSessionCookie: (token, expiresAt) =>
      res.cookie(SESSION_COOKIE, token, { httpOnly: true, sameSite: "strict", secure, expires: expiresAt, path: "/" }),
    clearSessionCookie: () => res.clearCookie(SESSION_COOKIE, { path: "/" }),
    now: () => new Date(),
    newId: () => randomUUID(),
  });

  app.use("/api/files", createFileRoutes(contextFor));
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext: ({ req, res }) => contextFor(req, res),
      // Never log inputs: they may contain PINs.
      onError: ({ error, path }) => {
        if (error.code === "INTERNAL_SERVER_ERROR") console.error(`[trpc] ${path ?? "?"}: ${error.message}`);
      },
    }),
  );
  return app;
}

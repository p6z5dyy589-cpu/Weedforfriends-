import express from "express";
import cookieParser from "cookie-parser";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "./routers";
import { SESSION_COOKIE, type Context } from "./_core/context";
import { AttemptLimiter } from "./auth/rateLimit";
import type { AuthStore } from "./auth/store";

export function createApp(store: AuthStore) {
  const app = express();
  const limiter = new AttemptLimiter();
  const secure = process.env.NODE_ENV === "production";

  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(cookieParser());
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext: ({ req, res }): Context => ({
        store,
        limiter,
        clientKey: req.ip ?? "unknown",
        sessionToken: typeof req.cookies?.[SESSION_COOKIE] === "string" ? req.cookies[SESSION_COOKIE] : null,
        setSessionCookie: (token, expiresAt) =>
          res.cookie(SESSION_COOKIE, token, { httpOnly: true, sameSite: "strict", secure, expires: expiresAt, path: "/" }),
        clearSessionCookie: () => res.clearCookie(SESSION_COOKIE, { path: "/" }),
        now: () => new Date(),
      }),
      // Never log inputs: they may contain PINs.
      onError: ({ error, path }) => {
        if (error.code === "INTERNAL_SERVER_ERROR") console.error(`[trpc] ${path ?? "?"}: ${error.message}`);
      },
    }),
  );
  return app;
}

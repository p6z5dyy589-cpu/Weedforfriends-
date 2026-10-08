import type { AuthStore } from "../auth/store";
import type { AttemptLimiter } from "../auth/rateLimit";

export const SESSION_COOKIE = "fe_kiosk";
export const SESSION_TTL_MS = 12 * 60 * 60_000;

export interface Context {
  store: AuthStore;
  limiter: AttemptLimiter;
  /** Stable key for rate limiting (e.g. client IP). */
  clientKey: string;
  sessionToken: string | null;
  setSessionCookie: (token: string, expiresAt: Date) => void;
  clearSessionCookie: () => void;
  now: () => Date;
}

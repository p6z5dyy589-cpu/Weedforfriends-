import type { TranslationKey } from "@/i18n";

interface ErrLike {
  message?: string;
  data?: { code?: string } | null;
}

/** Maps server errors to plain staff language - never technical text. */
export function errorKey(err: unknown): TranslationKey {
  const e = (err ?? {}) as ErrLike;
  const code = e.data?.code;
  const msg = e.message ?? "";
  if (code === "UNAUTHORIZED") return "error.session";
  if (code === "FORBIDDEN") return "error.forbidden";
  if (code === "NOT_FOUND") return "error.notFound";
  if (code === "BAD_REQUEST") return "error.invalid";
  if (code === "CONFLICT") {
    if (msg === "company_changed") return "error.companyChanged";
    if (msg === "login_taken") return "error.loginTaken";
    return "error.version";
  }
  if (code === "PRECONDITION_FAILED" && /^[a-z_]+$/.test(msg)) return `reason.${msg}` as TranslationKey;
  return "app.error";
}

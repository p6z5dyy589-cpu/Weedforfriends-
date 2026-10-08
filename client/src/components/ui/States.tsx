import { AlertTriangle, Inbox, Loader2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useErrorText } from "@/hooks/useErrorText";
import { Button } from "./Button";

export function Loading() {
  const { t } = useLanguage();
  return (
    <div role="status" className="flex items-center justify-center gap-2 p-8 text-slate-600">
      <Loader2 className="size-5 animate-spin motion-reduce:animate-none" aria-hidden />
      {t("app.loading")}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { t } = useLanguage();
  const text = useErrorText();
  return (
    <div role="alert" className="flex flex-col items-center gap-3 rounded-2xl bg-white p-6 text-center shadow-sm">
      <AlertTriangle className="size-6 text-stop" aria-hidden />
      <p className="font-medium">{text(error)}</p>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          {t("app.retry")}
        </Button>
      )}
    </div>
  );
}

export function EmptyState({ text, hint }: { text: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl bg-white p-6 text-center shadow-sm">
      <Inbox className="size-6 text-slate-400" aria-hidden />
      <p className="text-lg font-medium">{text}</p>
      {hint && <p className="text-slate-600">{hint}</p>}
    </div>
  );
}

/** Inline error text under a form or action. */
export function InlineError({ error }: { error: unknown }) {
  const text = useErrorText();
  if (!error) return null;
  return (
    <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm font-medium text-stop">
      {text(error)}
    </p>
  );
}

import { Link } from "wouter";
import type { TodayCard } from "@shared/today";
import { useLanguage } from "@/contexts/LanguageContext";
import { useMe } from "@/hooks/useMe";
import type { TranslationKey } from "@/i18n";
import { StatusBadge } from "./ui/StatusBadge";

export function quantityText(t: (k: TranslationKey) => string, q: number | null, unit: string): string {
  const locale = document.documentElement.lang === "cs" ? "cs-CZ" : "de-DE";
  return q === null ? "" : `${q.toLocaleString(locale)} ${t(`unit.${unit}` as TranslationKey)}`;
}

/**
 * Muster A - Arbeitskarte: status, product, company · reference · quantity,
 * responsible, ONE big action and "Etwas passt nicht" as the safe way out.
 */
export function WorkCard({ card, emphasis, quiet }: { card: TodayCard; emphasis?: boolean; quiet?: boolean }) {
  const { t } = useLanguage();
  const me = useMe();
  const company = me.companies.find((c) => c.id === card.companyId)?.name ?? "";
  const href = `/aufgabe/${card.id}`;
  const actionKey: TranslationKey =
    card.action === "openTask" && card.processType === "production"
      ? "action.openTask.production"
      : card.action === "openTask" && card.processType === "packaging"
        ? "action.openTask.packaging"
        : (`action.${card.action}` as TranslationKey);
  const waitingText =
    card.waitingFor === "dependency" ? t("home.waitingDependency") : card.status === "review" ? t("home.waitingReview") : card.status === "handover_offered" ? t("home.waitingHandover") : null;
  const isStop = card.status === "blocked";
  return (
    <article className={`flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm ${emphasis ? "ring-2 ring-brand" : ""} ${isStop ? "ring-2 ring-stop" : ""}`}>
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={card.status} />
      </div>
      <div>
        <p className="text-xl font-semibold leading-tight">{card.product}</p>
        <p className="text-slate-600">
          {[company, card.reference, quantityText(t, card.quantity, card.unit)].filter(Boolean).join(" · ")}
        </p>
        <p className="text-sm text-slate-600">
          {t("task.responsible")}: {card.responsible ?? t("app.unassigned")}
        </p>
        {isStop && card.blockReason && <p className="mt-1 font-medium text-stop">{t(`block.${card.blockReason}`)}</p>}
        {waitingText && <p className="mt-1 font-medium text-amber-800">{waitingText}</p>}
      </div>
      <Link
        href={href}
        className={`flex min-h-12 items-center justify-center rounded-xl px-5 text-base font-semibold ${
          isStop ? "border-2 border-stop text-stop" : card.action === "viewDetails" || quiet ? "border border-slate-300 text-slate-900" : "bg-brand text-white"
        }`}
      >
        {t(actionKey)}
      </Link>
      {!isStop && card.action !== "viewDetails" && (
        <Link href={`${href}?problem=1`} className="flex min-h-11 items-center justify-center text-sm font-medium text-slate-600 underline-offset-2 hover:underline">
          {t("home.somethingWrong")}
        </Link>
      )}
    </article>
  );
}

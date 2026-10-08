import { Link } from "wouter";
import type { TodayOverview } from "@shared/today";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { useMe } from "@/hooks/useMe";
import { navItemsFor } from "@shared/navigation";
import type { TranslationKey } from "@/i18n";
import { WorkCard } from "@/components/WorkCard";
import { EmptyState, ErrorState, Loading } from "@/components/ui/States";
import { Section } from "@/components/ui/Layout";

export function isOverviewEmpty(o: TodayOverview): boolean {
  return !o.now && o.next.length === 0 && o.waiting.length === 0 && o.labelsReady.length === 0 && o.clarify.length === 0;
}

/** "Mein Tag": at most five blocks, one dominant action (handbook 4.1). */
export default function Home() {
  const { t } = useLanguage();
  const me = useMe();
  const overview = trpc.today.overview.useQuery(undefined, { refetchInterval: 60_000 });
  const coordinationLinks = navItemsFor(me.roles).filter((i) => i.coordination).slice(0, 3);

  if (overview.isLoading) return <Loading />;
  // A response for another company than the active one is never rendered.
  if (overview.error || !overview.data || overview.data.companyId !== me.activeCompanyId) {
    return <ErrorState error={overview.error} onRetry={() => overview.refetch()} />;
  }
  const o = overview.data;

  return (
    <div className="flex flex-col gap-6">
      {o.clarify.length > 0 && (
        <Section title={t("home.clarify")} tone="stop">
          {o.clarify.map((c) => (
            <WorkCard key={c.id} card={c} />
          ))}
        </Section>
      )}
      {o.now && (
        <Section title={t("home.now")}>
          <WorkCard card={o.now} emphasis />
        </Section>
      )}
      {o.next.length > 0 && (
        <Section title={t("home.next")}>
          {o.next.slice(0, 2).map((c) => (
            <WorkCard key={c.id} card={c} />
          ))}
        </Section>
      )}
      {o.waiting.length > 0 && (
        <Section title={t("home.waiting")}>
          {o.waiting.map((c) => (
            <WorkCard key={c.id} card={c} />
          ))}
        </Section>
      )}
      {o.labelsReady.length > 0 && (
        <Section title={t("home.labelsReady")}>
          {o.labelsReady.map((c) => (
            <WorkCard key={c.id} card={c} />
          ))}
        </Section>
      )}
      {isOverviewEmpty(o) && <EmptyState text={t("home.empty")} hint={t("home.emptyHint")} />}
      {coordinationLinks.length > 0 && (
        <nav aria-label={t("home.coordinationHint")} className="flex flex-wrap gap-2 border-t border-slate-200 pt-4">
          {coordinationLinks.map((i) => (
            <Link key={i.path} href={i.path} className="inline-flex min-h-11 items-center rounded-lg border border-indigo-200 bg-white px-3 text-sm font-medium text-indigo-800">
              {t(i.labelKey as TranslationKey)}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}

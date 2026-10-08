import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { StatusMessage } from "@/components/StatusMessage";
import type { TranslationKey } from "@/i18n/de";
import type { TodayCard, TodayOverview } from "@shared/today";

export function isOverviewEmpty(o: TodayOverview): boolean {
  return !o.now && o.next.length === 0 && o.waiting.length === 0 && o.labelsReady.length === 0 && o.clarify.length === 0;
}

function Card({ card, emphasis }: { card: TodayCard; emphasis?: boolean }) {
  return (
    <article className={`rounded-xl bg-white p-4 shadow-sm ${emphasis ? "ring-2 ring-brand" : ""}`}>
      <p className="text-sm text-slate-500">{card.reference}</p>
      <p className="text-lg font-semibold">{card.product}</p>
      <p>{card.quantity}</p>
      <p className="text-sm text-slate-600">
        {card.responsible} · {card.status}
      </p>
    </article>
  );
}

function Section({ titleKey, cards, stop }: { titleKey: TranslationKey; cards: TodayCard[]; stop?: boolean }) {
  const { t } = useLanguage();
  if (cards.length === 0) return null;
  return (
    <section className="flex flex-col gap-2">
      <h2 className={`font-semibold ${stop ? "text-stop" : "text-slate-700"}`}>{t(titleKey)}</h2>
      {cards.map((c) => (
        <Card key={c.id} card={c} />
      ))}
    </section>
  );
}

export default function Home({ activeCompanyId }: { activeCompanyId: number }) {
  const { t } = useLanguage();
  const overview = trpc.today.overview.useQuery();

  if (overview.isLoading) return <StatusMessage text={t("app.loading")} />;
  // A response for another company than the active one is never rendered.
  if (overview.error || !overview.data || overview.data.companyId !== activeCompanyId) {
    return <StatusMessage text={t("app.error")} actionLabel={t("app.retry")} onAction={() => overview.refetch()} />;
  }

  const o = overview.data;
  if (isOverviewEmpty(o)) {
    return (
      <div className="rounded-xl bg-white p-6 text-center shadow-sm">
        <p className="text-lg font-medium">{t("home.empty")}</p>
        <p className="mt-2 text-slate-600">{t("home.emptyHint")}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Section titleKey="home.clarify" cards={o.clarify} stop />
      {o.now && (
        <section className="flex flex-col gap-2">
          <h2 className="font-semibold">{t("home.now")}</h2>
          <Card card={o.now} emphasis />
        </section>
      )}
      <Section titleKey="home.next" cards={o.next.slice(0, 2)} />
      <Section titleKey="home.waiting" cards={o.waiting} />
      <Section titleKey="home.labelsReady" cards={o.labelsReady} />
    </div>
  );
}

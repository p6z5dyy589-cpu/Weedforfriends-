import type { ComponentType } from "react";
import { Link } from "wouter";
import { ArrowRightLeft, CircleHelp, Hourglass, OctagonAlert, PlayCircle, UserMinus, UserX } from "lucide-react";
import type { BlockReason } from "@shared/tasks";
import { trpc } from "@/lib/trpc";
import { useLanguage, type Translate } from "@/contexts/LanguageContext";
import { useHasRole } from "@/hooks/useMe";
import type { TranslationKey } from "@/i18n";
import { PageHeader, Section } from "@/components/ui/Layout";
import { EmptyState, ErrorState, Loading } from "@/components/ui/States";
import { StatusBadge } from "@/components/ui/StatusBadge";

type ListKey = "blocked" | "review" | "handovers" | "unassigned";
type CountKey = ListKey | "inProgress" | "unknownAttendance" | "absent";

const ICONS: Record<CountKey, ComponentType<{ className?: string; "aria-hidden"?: boolean }>> = {
  blocked: OctagonAlert,
  review: Hourglass,
  handovers: ArrowRightLeft,
  unassigned: UserMinus,
  inProgress: PlayCircle,
  unknownAttendance: CircleHelp,
  absent: UserX,
};

function sinceText(t: Translate, since: Date, now = Date.now()): string {
  const min = Math.max(0, Math.floor((now - new Date(since).getTime()) / 60_000));
  if (min < 1) return t("admin.since.justNow");
  if (min < 60) return t("admin.since.minutes", { n: min });
  if (min < 60 * 24) return t("admin.since.hours", { n: Math.floor(min / 60) });
  return t("admin.since.days", { n: Math.floor(min / (60 * 24)) });
}

const sectionId = (k: ListKey) => `leitstand-${k}`;

/** Leitstand: who needs a decision, and why. Read-only; every row opens the task. */
export default function Control() {
  const { t, language } = useLanguage();
  const canTeam = useHasRole("coordinator");
  const canPlan = useHasRole("planner", "coordinator");
  const overview = trpc.control.overview.useQuery(undefined, { refetchInterval: 60_000 });

  if (overview.isLoading) return <Loading />;
  if (overview.error || !overview.data) return <ErrorState error={overview.error} onRetry={() => overview.refetch()} />;
  const o = overview.data;
  const c = o.counts;
  const dateText = new Date(`${o.date}T00:00:00Z`).toLocaleDateString(language === "cs" ? "cs-CZ" : "de-DE", {
    weekday: "long",
    day: "numeric",
    month: "numeric",
    timeZone: "UTC",
  });

  const tileCls = "flex min-h-24 flex-col justify-between gap-1 rounded-2xl bg-white p-3 text-left shadow-sm";
  const tileBody = (k: CountKey, stop?: boolean) => {
    const Icon = ICONS[k];
    return (
      <>
        <span className={`text-3xl font-bold ${stop && c[k] > 0 ? "text-stop" : ""}`}>{c[k]}</span>
        <span className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
          <Icon className="size-4 shrink-0" aria-hidden />
          {t(`admin.control.${k}` as TranslationKey)}
        </span>
      </>
    );
  };
  const scrollTile = (k: ListKey) => (
    <button key={k} type="button" className={`${tileCls} ${k === "blocked" && c.blocked > 0 ? "ring-2 ring-stop" : ""}`} onClick={() => document.getElementById(sectionId(k))?.scrollIntoView({ behavior: "smooth" })}>
      {tileBody(k, k === "blocked")}
    </button>
  );
  const linkTile = (k: CountKey, href: string | null) =>
    href ? (
      <Link key={k} href={href} className={tileCls}>
        {tileBody(k)}
      </Link>
    ) : (
      <div key={k} className={tileCls}>
        {tileBody(k)}
      </div>
    );

  const lists: ListKey[] = ["blocked", "review", "handovers", "unassigned"];
  const nothing = lists.every((k) => o[k].length === 0);
  const now = Date.now();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("nav.item.control")} coordination />
      <p className="-mt-4 text-sm text-slate-600">{t("admin.control.date", { date: dateText })}</p>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {lists.map(scrollTile)}
        {linkTile("inProgress", canPlan ? "/planung" : null)}
        {linkTile("unknownAttendance", canTeam ? "/team" : null)}
        {linkTile("absent", canTeam ? "/team" : null)}
      </div>

      {canTeam && (c.unknownAttendance > 0 || c.absent > 0) && (
        <Link href="/team" className="flex min-h-12 items-center justify-center rounded-xl border border-slate-300 bg-white px-5 font-semibold">
          {t("admin.control.attendance")}
        </Link>
      )}

      {nothing && <EmptyState text={t("admin.control.allClear")} />}

      {lists.map((k) => (
        <div key={k} id={sectionId(k)} className="scroll-mt-4">
          <Section title={`${t(`admin.control.${k}` as TranslationKey)} (${c[k]})`} tone={k === "blocked" && c.blocked > 0 ? "stop" : undefined}>
            {o[k].length === 0 ? (
              <p className="text-sm text-slate-500">{t("admin.control.listEmpty")}</p>
            ) : (
              o[k].map((r) => (
                <Link key={r.id} href={`/aufgabe/${r.id}`} className={`flex flex-col gap-1 rounded-2xl bg-white p-3 shadow-sm ${k === "blocked" ? "border-l-4 border-stop" : ""}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <StatusBadge status={r.status} />
                    <span className="text-sm text-slate-600">{sinceText(t, r.since, now)}</span>
                  </div>
                  <span className="text-lg font-semibold leading-tight">{r.product}</span>
                  <span className="text-sm text-slate-600">
                    {[t(`process.${r.processType}`), r.reference, r.assigneeName ?? t("app.unassigned")].filter(Boolean).join(" · ")}
                  </span>
                  {k === "blocked" && r.blockReason && <span className="font-medium text-stop">{t(`block.${r.blockReason as BlockReason}`)}</span>}
                </Link>
              ))
            )}
          </Section>
        </div>
      ))}
    </div>
  );
}

import { Link } from "wouter";
import type { TaskStatus } from "@shared/tasks";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { useHasRole } from "@/hooks/useMe";
import type { TranslationKey } from "@/i18n";
import { PageHeader, Section } from "@/components/ui/Layout";
import { EmptyState, ErrorState, Loading } from "@/components/ui/States";
import { LocalBadge } from "@/components/ui/StatusBadge";
import { TaskRows } from "@/components/TaskRow";

const GROUPS: { key: string; statuses: TaskStatus[]; title: TranslationKey; stop?: boolean }[] = [
  { key: "open", statuses: ["open", "in_progress"], title: "flow.incoming.open" },
  { key: "blocked", statuses: ["blocked"], title: "flow.section.clarify", stop: true },
  { key: "checked", statuses: ["checked"], title: "flow.incoming.checked" },
];

/** Wareneingang: local check only - booking happens deliberately in Odoo. */
export default function Incoming() {
  const { t } = useLanguage();
  const mayCreate = useHasRole("planner", "coordinator", "reviewer", "incoming");
  const list = trpc.tasks.list.useQuery({ scope: "incoming" }, { refetchInterval: 60_000 });

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t("nav.item.incoming")}>
        <LocalBadge />
      </PageHeader>
      <p className="text-sm font-medium text-slate-700">{t("task.incoming.bookInOdoo")}</p>
      {mayCreate && (
        <Link href="/aufgabe-neu" className="flex min-h-12 items-center justify-center rounded-xl bg-brand px-5 text-base font-semibold text-white">
          {t("flow.incoming.new")}
        </Link>
      )}
      {list.isLoading ? (
        <Loading />
      ) : list.error || !list.data ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : list.data.length === 0 ? (
        <EmptyState text={t("flow.incoming.empty")} />
      ) : (
        <div className="flex flex-col gap-6">
          {GROUPS.map((g) => {
            const tasks = list.data.filter((x) => g.statuses.includes(x.status));
            if (tasks.length === 0) return null;
            return (
              <Section key={g.key} title={`${t(g.title)} (${tasks.length})`} tone={g.stop ? "stop" : undefined}>
                <TaskRows tasks={tasks} />
              </Section>
            );
          })}
        </div>
      )}
    </div>
  );
}

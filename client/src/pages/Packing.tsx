import { Link } from "wouter";
import type { TaskStatus } from "@shared/tasks";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import type { TranslationKey } from "@/i18n";
import { PageHeader, Section } from "@/components/ui/Layout";
import { EmptyState, ErrorState, Loading } from "@/components/ui/States";
import { LocalBadge } from "@/components/ui/StatusBadge";
import { TaskRows } from "@/components/TaskRow";

const GROUPS: { status: TaskStatus; title: TranslationKey; stop?: boolean }[] = [
  { status: "handover_offered", title: "flow.packing.waiting" },
  { status: "packing", title: "flow.packing.packing" },
  { status: "open", title: "flow.packing.open" },
  { status: "blocked", title: "flow.section.clarify", stop: true },
];

/** Packen & Übergabe: two-step handover, then the local pack list. */
export default function Packing() {
  const { t } = useLanguage();
  const list = trpc.tasks.list.useQuery({ scope: "packing" }, { refetchInterval: 60_000 });

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t("nav.item.packing")}>
        <LocalBadge />
      </PageHeader>
      {list.isLoading ? (
        <Loading />
      ) : list.error || !list.data ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : list.data.length === 0 ? (
        <EmptyState text={t("flow.packing.empty")} />
      ) : (
        <div className="flex flex-col gap-6">
          {GROUPS.map((g) => {
            const tasks = list.data.filter((x) => x.status === g.status);
            if (tasks.length === 0) return null;
            return (
              <Section key={g.status} title={`${t(g.title)} (${tasks.length})`} tone={g.stop ? "stop" : undefined}>
                <TaskRows
                  tasks={tasks}
                  renderExtra={
                    g.status === "handover_offered"
                      ? (task) => (
                          <Link href={`/aufgabe/${task.id}`} className="flex min-h-12 items-center justify-center rounded-xl bg-brand px-5 text-base font-semibold text-white">
                            {t("action.acceptHandover")}
                          </Link>
                        )
                      : undefined
                  }
                />
              </Section>
            );
          })}
        </div>
      )}
      <Link href="/arbeitsplatz?tab=ready" className="inline-flex min-h-11 w-fit items-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-900">
        {t("flow.packing.toReady")}
      </Link>
    </div>
  );
}

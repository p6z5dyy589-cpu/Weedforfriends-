import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { PageHeader } from "@/components/ui/Layout";
import { EmptyState, ErrorState, Loading } from "@/components/ui/States";
import { LocalBadge } from "@/components/ui/StatusBadge";
import { TaskRows } from "@/components/TaskRow";

/** Vincent-Prüfung: everything waiting for a local review, oldest planned first. */
export default function ReviewList() {
  const { t } = useLanguage();
  const list = trpc.tasks.list.useQuery({ scope: "review" }, { refetchInterval: 60_000 });

  return (
    <div className="flex flex-col">
      <PageHeader title={t("nav.item.review")}>
        <LocalBadge />
      </PageHeader>
      <p className="mb-4 text-slate-700">{t("flow.review.intro")}</p>
      {list.isLoading ? (
        <Loading />
      ) : list.error || !list.data ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : list.data.length === 0 ? (
        <EmptyState text={t("flow.review.empty")} />
      ) : (
        // The server already sorts by planned date (oldest first), then sequence.
        <TaskRows tasks={list.data} />
      )}
    </div>
  );
}

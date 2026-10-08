import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { useBase } from "@/hooks/useMe";
import { relativeTime } from "@/lib/time";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/Layout";
import { EmptyState, ErrorState, InlineError, Loading } from "@/components/ui/States";


/** In-app notifications (no push). */
export default function Notifications() {
  const { t, language } = useLanguage();
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const base = useBase();
  const list = trpc.notifications.list.useQuery();
  const markRead = trpc.notifications.markRead.useMutation({
    onSuccess: () => {
      base.reset();
      void utils.notifications.list.invalidate();
      void utils.notifications.unreadCount.invalidate();
    },
  });

  const hasUnread = list.data?.some((n) => !n.read) ?? false;

  const open = (n: NonNullable<typeof list.data>[number]) => {
    if (!n.read) markRead.mutate(base({ ids: [n.id] }));
    if (n.conversationId) navigate(`/chat/${encodeURIComponent(n.conversationId)}`);
    else if (n.taskId) navigate(`/aufgabe/${n.taskId}`);
  };

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t("comms.notifications.title")}>
        {hasUnread && (
          <Button variant="secondary" loading={markRead.isPending} onClick={() => markRead.mutate(base({ ids: null }))}>
            {t("comms.notifications.markAll")}
          </Button>
        )}
      </PageHeader>
      <InlineError error={markRead.error} />
      {list.isLoading ? (
        <Loading />
      ) : list.error || !list.data ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : list.data.length === 0 ? (
        <EmptyState text={t("comms.notifications.empty")} hint={t("comms.notifications.emptyHint")} />
      ) : (
        <ul className="flex flex-col gap-2">
          {list.data.map((n) => {
            const target = n.conversationId || n.taskId;
            return (
              <li key={n.id}>
                <button
                  type="button"
                  disabled={!target}
                  onClick={() => open(n)}
                  className={`flex min-h-14 w-full items-start gap-3 rounded-2xl p-4 text-left shadow-sm disabled:cursor-default ${n.read ? "bg-white" : "bg-blue-50 ring-1 ring-blue-200"}`}
                >
                  <span aria-hidden className={`mt-2 size-2.5 shrink-0 rounded-full ${n.read ? "bg-transparent" : "bg-blue-600"}`} />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className={n.read ? "font-medium" : "font-semibold"}>{t(`comms.note.${n.type}`)}</span>
                      {!n.read && <span className="rounded-full bg-blue-600 px-2 py-0.5 text-xs font-semibold text-white">{t("comms.new")}</span>}
                    </span>
                    <span className="text-sm text-slate-600">
                      {n.actorName && <>{t("comms.notifications.from", { name: n.actorName })} · </>}
                      <time dateTime={new Date(n.at).toISOString()}>{relativeTime(n.at, language)}</time>
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

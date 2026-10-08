import { useState } from "react";
import { Link, useLocation } from "wouter";
import { MessageCirclePlus, Users } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { useMe } from "@/hooks/useMe";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/Layout";
import { Sheet } from "@/components/ui/Sheet";
import { EmptyState, ErrorState, Loading } from "@/components/ui/States";
import { relativeTime } from "@/lib/time";

export default function ChatList() {
  const { t, language } = useLanguage();
  const [newOpen, setNewOpen] = useState(false);
  const convs = trpc.chat.conversations.useQuery(undefined, { refetchInterval: 15_000 });

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t("comms.chat.title")}>
        <Button variant="secondary" icon={<MessageCirclePlus className="size-5" aria-hidden />} onClick={() => setNewOpen(true)}>
          {t("comms.chat.newDirect")}
        </Button>
      </PageHeader>
      {convs.isLoading ? (
        <Loading />
      ) : convs.error || !convs.data ? (
        <ErrorState error={convs.error} onRetry={() => convs.refetch()} />
      ) : convs.data.length === 0 ? (
        <EmptyState text={t("comms.chat.noMessages")} />
      ) : (
        <ul className="flex flex-col gap-2">
          {convs.data.map((c) => {
            const title =
              c.type === "team" ? t("comms.chat.team") : (c.title ?? (c.type === "direct" ? t("comms.chat.direct") : t("comms.chat.task")));
            const kind = c.type === "task" ? t("comms.chat.task") : c.type === "direct" ? t("comms.chat.direct") : null;
            return (
              <li key={c.id}>
                <Link
                  href={`/chat/${encodeURIComponent(c.id)}`}
                  className={`flex min-h-16 items-center gap-3 rounded-2xl bg-white p-4 shadow-sm hover:bg-slate-50 ${c.type === "team" ? "ring-1 ring-indigo-200" : ""}`}
                >
                  {c.type === "team" && <Users className="size-6 shrink-0 text-indigo-700" aria-hidden />}
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className={`truncate ${c.unread > 0 ? "font-bold" : "font-semibold"}`}>{title}</span>
                      {c.lastText !== null && <span className="shrink-0 text-xs text-slate-500">{relativeTime(c.lastAt, language)}</span>}
                    </span>
                    {kind && <span className="text-xs text-slate-500">{kind}</span>}
                    <span className="truncate text-sm text-slate-600">{c.lastText ?? t("comms.chat.noMessages")}</span>
                  </span>
                  {c.unread > 0 && (
                    <span
                      className="flex min-w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 px-2 py-0.5 text-sm font-bold text-white"
                      aria-label={t("comms.chat.unread", { count: c.unread })}
                    >
                      {c.unread}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <NewDirectSheet open={newOpen} onOpenChange={setNewOpen} />
    </div>
  );
}

function NewDirectSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t } = useLanguage();
  const me = useMe();
  const [, navigate] = useLocation();
  const people = trpc.people.directory.useQuery(undefined, { enabled: open });
  const others = people.data?.filter((p) => p.id !== me.id) ?? [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={t("comms.chat.newDirect")}>
      {people.isLoading ? (
        <Loading />
      ) : people.error || !people.data ? (
        <ErrorState error={people.error} onRetry={() => people.refetch()} />
      ) : others.length === 0 ? (
        <EmptyState text={t("comms.chat.noPeople")} />
      ) : (
        <ul className="flex flex-col gap-1">
          {others.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => {
                  onOpenChange(false);
                  navigate(`/chat/${encodeURIComponent(`direct:${p.id}`)}`);
                }}
                className="flex min-h-12 w-full items-center rounded-xl border border-slate-200 bg-white px-4 text-left font-medium hover:bg-slate-50"
              >
                {p.displayName}
                <span className="ml-2 text-sm font-normal text-slate-500">@{p.loginName}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}

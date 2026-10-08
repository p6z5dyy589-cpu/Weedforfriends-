import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { Check, ExternalLink, Info, Send } from "lucide-react";
import { MAX_MESSAGE_LENGTH } from "@shared/chat";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { useBase } from "@/hooks/useMe";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/Layout";
import { EmptyState, ErrorState, InlineError, Loading } from "@/components/ui/States";

export type ChatTarget = { kind: "team" } | { kind: "direct"; userId: number } | { kind: "task"; taskId: string } | { kind: "id"; id: string };

/** Maps the route id to a chat target: "team", "direct:<userId>", "task:<taskId>" or a conversation id. */
export function targetFromRouteId(id: string): ChatTarget {
  if (id === "team") return { kind: "team" };
  if (id.startsWith("direct:")) {
    const userId = Number(id.slice("direct:".length));
    if (Number.isInteger(userId) && userId > 0) return { kind: "direct", userId };
  }
  if (id.startsWith("task:") && id.length > "task:".length) return { kind: "task", taskId: id.slice("task:".length) };
  return { kind: "id", id };
}

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

export default function ChatRoom({ id }: { id: string }) {
  const { t, language } = useLanguage();
  const utils = trpc.useUtils();
  const target = useMemo(() => targetFromRouteId(id), [id]);
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const markedRef = useRef<string | null>(null);

  const open = trpc.chat.open.useQuery({ target }, { refetchInterval: 5000 });

  const sendBase = useBase();
  const send = trpc.chat.send.useMutation({
    onSuccess: () => {
      sendBase.reset();
      setText("");
      void open.refetch();
      void utils.chat.conversations.invalidate();
      void utils.chat.unreadTotal.invalidate();
    },
  });

  const readBase = useBase();
  const markRead = trpc.chat.markRead.useMutation({
    onSuccess: () => {
      readBase.reset();
      void utils.chat.conversations.invalidate();
      void utils.chat.unreadTotal.invalidate();
    },
  });

  const data = open.data;
  const lastId = data?.messages[data.messages.length - 1]?.id ?? null;

  // Mark as read once per new last message (no loop on every refetch).
  useEffect(() => {
    if (!data || !lastId) return;
    const key = `${data.id}|${lastId}`;
    if (markedRef.current === key) return;
    markedRef.current = key;
    markRead.mutate(readBase({ conversationId: data.id }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.id, lastId]);

  // Scroll to the newest message.
  useEffect(() => {
    if (!lastId) return;
    endRef.current?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "end" });
  }, [lastId]);

  if (open.isLoading) return <Loading />;
  if (open.error || !data) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title={t("comms.chat.title")} back="/chat" />
        <ErrorState error={open.error} onRetry={() => open.refetch()} />
      </div>
    );
  }

  const title =
    data.type === "team" ? t("comms.chat.team") : (data.title ?? (data.type === "direct" ? t("comms.chat.direct") : t("comms.chat.task")));
  const trimmed = text.trim();
  const tooLong = text.length > MAX_MESSAGE_LENGTH;
  const canSend = trimmed.length >= 1 && !tooLong && !send.isPending;

  const submit = () => {
    if (!canSend) return;
    send.mutate(sendBase({ target, text: trimmed }));
  };

  return (
    <div className="flex flex-col gap-3">
      <PageHeader title={title} back="/chat">
        {data.type === "task" && data.taskId && (
          <Link
            href={`/aufgabe/${data.taskId}`}
            className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-900 hover:bg-slate-50"
          >
            <ExternalLink className="size-4" aria-hidden />
            {t("comms.room.openTask")}
          </Link>
        )}
      </PageHeader>

      {data.type === "task" && (
        <p className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          {t("comms.room.taskNote")}
        </p>
      )}

      {data.messages.length === 0 ? (
        <EmptyState text={t("comms.room.empty")} hint={t("comms.room.emptyHint")} />
      ) : (
        <ol className="flex flex-col gap-2" aria-live="polite">
          {data.messages.map((m) => (
            <li key={m.id} className={`flex ${m.mine ? "justify-end" : "justify-start"}`}>
              <div className={`flex max-w-[85%] flex-col gap-1 rounded-2xl px-3 py-2 shadow-sm ${m.mine ? "bg-brand text-white" : "bg-white text-slate-900"}`}>
                <span className={`text-xs font-semibold ${m.mine ? "text-white/80" : "text-slate-600"}`}>
                  {m.mine ? t("comms.room.you") : (m.authorName ?? t("comms.unknownPerson"))}
                </span>
                <p className="whitespace-pre-wrap break-words">{m.text}</p>
                <span className={`flex items-center justify-end gap-1 text-xs ${m.mine ? "text-white/80" : "text-slate-500"}`}>
                  <time dateTime={new Date(m.at).toISOString()}>
                    {new Date(m.at).toLocaleString(language, { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </time>
                  {data.type === "direct" && m.mine && m.readByOther && (
                    <>
                      <span aria-hidden>·</span>
                      <Check className="size-3.5" aria-hidden />
                      {t("comms.room.read")}
                    </>
                  )}
                </span>
              </div>
            </li>
          ))}
        </ol>
      )}
      <div ref={endRef} />

      <form
        className="sticky bottom-0 -mx-4 flex flex-col gap-2 border-t border-slate-200 bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <label htmlFor="chat-composer" className="text-sm font-medium text-slate-700">
          {t("comms.room.message")}
          <span className="ml-1 font-normal text-slate-500">({t("comms.room.mentionHint")})</span>
        </label>
        <div className="flex items-end gap-2">
          <textarea
            id="chat-composer"
            rows={2}
            value={text}
            maxLength={MAX_MESSAGE_LENGTH}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                submit();
              }
            }}
            className="min-h-12 flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-base focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
          />
          <Button type="submit" disabled={!canSend} loading={send.isPending} aria-label={t("comms.room.send")} icon={<Send className="size-5" aria-hidden />}>
            <span className="sr-only sm:not-sr-only">{t("comms.room.send")}</span>
          </Button>
        </div>
        {text.length > MAX_MESSAGE_LENGTH - 200 && (
          <p className={`text-xs ${tooLong ? "text-stop" : "text-slate-500"}`}>{t("comms.room.chars", { count: text.length, max: MAX_MESSAGE_LENGTH })}</p>
        )}
        <InlineError error={send.error} />
      </form>
    </div>
  );
}

import { useState } from "react";
import { Link } from "wouter";
import { CheckCircle2, CircleHelp, XCircle } from "lucide-react";
import { ATTENDANCE, type Attendance } from "@shared/coordination";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { useBase, useHasRole } from "@/hooks/useMe";
import { Card, PageHeader, Section } from "@/components/ui/Layout";
import { Button } from "@/components/ui/Button";
import { TextInput } from "@/components/ui/Fields";
import { ErrorState, InlineError, Loading } from "@/components/ui/States";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";

const ATT_ICON = { present: CheckCircle2, absent: XCircle, unknown: CircleHelp } as const;
const ATT_ON: Record<Attendance, string> = {
  present: "border-emerald-700 bg-emerald-700 text-white",
  absent: "border-stop bg-stop text-white",
  unknown: "border-slate-700 bg-slate-700 text-white",
};

function useInvalidateCoordination() {
  const utils = trpc.useUtils();
  return () => {
    void utils.coordination.attendance.invalidate();
    void utils.coordination.proposals.invalidate();
    void utils.control.overview.invalidate();
  };
}

function AttendanceRow({ date, person, canEdit }: { date: string; person: { userId: number; displayName: string; status: Attendance; version: number }; canEdit: boolean }) {
  const { t } = useLanguage();
  const base = useBase();
  const refresh = useInvalidateCoordination();
  const m = trpc.coordination.setAttendance.useMutation({
    onSuccess: () => {
      base.reset();
      refresh();
    },
    onError: () => refresh(),
  });
  return (
    <Card className="flex flex-col gap-2">
      <p className="font-semibold">{person.displayName}</p>
      <div role="group" aria-label={person.displayName} className="grid grid-cols-3 gap-2">
        {ATTENDANCE.map((s) => {
          const Icon = ATT_ICON[s];
          const on = person.status === s;
          return (
            <button
              key={s}
              type="button"
              aria-pressed={on}
              disabled={!canEdit || m.isPending}
              onClick={() => !on && m.mutate(base({ date, userId: person.userId, status: s, version: person.version }))}
              className={`flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-xl border-2 px-1 text-sm font-semibold disabled:cursor-not-allowed ${
                on ? ATT_ON[s] : "border-slate-300 bg-white text-slate-800"
              } ${!canEdit && !on ? "opacity-50" : ""}`}
            >
              <Icon className="size-5" aria-hidden />
              {t(`admin.att.${s}`)}
            </button>
          );
        })}
      </div>
      <InlineError error={m.error} />
    </Card>
  );
}

/** Anwesenheit & Vertretung (handbook 12) - Muster D for substitution proposals. */
export default function Team() {
  const { t, language } = useLanguage();
  const toast = useToast();
  const isCoordinator = useHasRole("coordinator");
  const base = useBase();
  const refresh = useInvalidateCoordination();
  const utils = trpc.useUtils();
  const [date, setDate] = useState<string | undefined>(undefined);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [reviewIds, setReviewIds] = useState<string[] | null>(null);

  const attendance = trpc.coordination.attendance.useQuery({ date });
  const day = date ?? attendance.data?.date;
  const proposals = trpc.coordination.proposals.useQuery({ date: day }, { enabled: day !== undefined });
  const confirm = trpc.coordination.confirmProposals.useMutation({
    onSuccess: (res) => {
      base.reset();
      toast(t("admin.team.done", { count: res.moved }));
      setSelected(new Set());
      setReviewIds(null);
      refresh();
      void utils.tasks.list.invalidate();
    },
    onError: () => refresh(),
  });

  if (attendance.isLoading) return <Loading />;
  if (attendance.error || !attendance.data) return <ErrorState error={attendance.error} onRetry={() => attendance.refetch()} />;
  const a = attendance.data;
  const locale = language === "cs" ? "cs-CZ" : "de-DE";
  const dayText = new Date(`${a.date}T00:00:00Z`).toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "numeric", timeZone: "UTC" });

  const p = proposals.data && proposals.data.date === a.date ? proposals.data : undefined;
  const list = p?.proposals ?? [];
  const reviewing = reviewIds ? list.filter((x) => reviewIds.includes(x.taskId)) : [];
  const toggle = (id: string, on: boolean) =>
    setSelected((cur) => {
      const next = new Set(cur);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  const chosen = list.filter((x) => selected.has(x.taskId));
  const name = (n: string | null) => n ?? t("app.none");
  const taskLine = (x: { reference: string; product: string }) => [x.product, x.reference].filter(Boolean).join(" · ");

  return (
    <div className={`flex flex-col gap-6 ${chosen.length > 0 ? "pb-28" : ""}`}>
      <PageHeader title={t("nav.item.team")} coordination />

      <TextInput
        label={t("admin.team.date")}
        hint={dayText}
        type="date"
        value={a.date}
        onChange={(e) => {
          if (!e.target.value) return;
          setDate(e.target.value);
          setSelected(new Set());
        }}
      />

      <Section title={t("admin.team.attendance")}>
        <p className="text-sm text-slate-600">{t("admin.team.unknownHint")}</p>
        {!isCoordinator && <p className="text-sm font-medium text-slate-700">{t("admin.readOnly")}</p>}
        {a.people.length === 0 ? (
          <p className="text-sm text-slate-500">{t("admin.team.noPeople")}</p>
        ) : (
          a.people.map((person) => <AttendanceRow key={person.userId} date={a.date} person={person} canEdit={isCoordinator} />)
        )}
      </Section>

      {proposals.isLoading || (proposals.isFetching && !p) ? (
        <Loading />
      ) : proposals.error || !p ? (
        <ErrorState error={proposals.error} onRetry={() => proposals.refetch()} />
      ) : (
        <>
          <Section title={`${t("admin.team.proposals")} (${list.length})`}>
            {list.length === 0 ? (
              <p className="text-sm text-slate-500">{t("admin.team.noProposals")}</p>
            ) : (
              <>
                {isCoordinator && list.length > 1 && (
                  <Button variant="ghost" className="w-fit" onClick={() => setSelected(new Set(list.map((x) => x.taskId)))}>
                    {t("admin.team.selectAll")}
                  </Button>
                )}
                {list.map((x) => (
                  <Card key={x.taskId} className={`flex gap-3 ${selected.has(x.taskId) ? "ring-2 ring-brand" : ""}`}>
                    {isCoordinator && (
                      <input
                        type="checkbox"
                        className="mt-1 size-7 shrink-0 accent-brand"
                        aria-label={taskLine(x)}
                        checked={selected.has(x.taskId)}
                        onChange={(e) => toggle(x.taskId, e.target.checked)}
                      />
                    )}
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <p className="font-semibold text-stop">{t("admin.team.proposalWho", { from: name(x.fromName) })}</p>
                      <Link href={`/aufgabe/${x.taskId}`} className="text-lg font-semibold leading-tight underline-offset-2 hover:underline">
                        {taskLine(x)}
                      </Link>
                      {x.workType && <p className="text-sm text-slate-600">{t(`work.${x.workType}`)}</p>}
                      <p className="text-sm">{t("admin.team.proposalWhy")}</p>
                      <p className="font-medium">
                        {name(x.fromName)} → {name(x.toName)}
                      </p>
                      <p className="text-sm">{t("admin.team.proposalSafe", { to: name(x.toName) })}</p>
                      <p className="text-sm text-slate-600">{t("admin.team.proposalEffect", { to: name(x.toName) })}</p>
                      {isCoordinator && (
                        <Button variant="secondary" className="mt-1" onClick={() => setReviewIds([x.taskId])}>
                          {t("admin.reviewProposal")}
                        </Button>
                      )}
                    </div>
                  </Card>
                ))}
              </>
            )}
          </Section>

          <Section title={`${t("admin.team.clarify")} (${p.clarifications.length})`} tone={p.clarifications.length > 0 ? "stop" : undefined}>
            {p.clarifications.length === 0 ? (
              <p className="text-sm text-slate-500">{t("admin.team.noClarify")}</p>
            ) : (
              p.clarifications.map((c) => (
                <Card key={c.taskId} className="flex flex-col gap-1 border-l-4 border-stop">
                  <p className="font-semibold text-stop">{t(`admin.team.reason.${c.reason}`)}</p>
                  <Link href={`/aufgabe/${c.taskId}`} className="font-semibold underline-offset-2 hover:underline">
                    {taskLine(c)}
                  </Link>
                  <p className="text-sm text-slate-600">
                    {t("task.responsible")}: {name(c.userName)}
                  </p>
                  <p className="text-sm">{t(`admin.team.clarifyHint.${c.reason}`, { name: name(c.userName) })}</p>
                </Card>
              ))
            )}
          </Section>

          {p.runningStays.length > 0 && (
            <Section title={`${t("admin.team.running")} (${p.runningStays.length})`}>
              <p className="text-sm text-slate-600">{t("admin.team.runningHint")}</p>
              {p.runningStays.map((r) => (
                <Link key={r.taskId} href={`/aufgabe/${r.taskId}`} className="flex flex-col rounded-2xl bg-white p-3 shadow-sm">
                  <span className="font-semibold">{taskLine(r)}</span>
                  <span className="text-sm text-slate-600">
                    {t("task.responsible")}: {name(r.userName)}
                  </span>
                </Link>
              ))}
            </Section>
          )}
        </>
      )}

      {isCoordinator && chosen.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-lg">
          <div className="mx-auto max-w-2xl">
            <Button block onClick={() => setReviewIds(chosen.map((x) => x.taskId))}>
              {t("admin.team.reviewSelected", { count: chosen.length })}
            </Button>
          </div>
        </div>
      )}

      <Sheet open={reviewIds !== null} onOpenChange={(o) => !o && setReviewIds(null)} title={t("admin.team.confirmTitle")}>
        <ul className="flex flex-col gap-2">
          {reviewing.map((x) => (
            <li key={x.taskId} className="rounded-xl border border-slate-200 p-3">
              <p className="font-semibold">{taskLine(x)}</p>
              <p className="text-sm font-medium">
                {name(x.fromName)} → {name(x.toName)}
              </p>
              <p className="text-sm text-slate-600">{t("admin.team.proposalEffect", { to: name(x.toName) })}</p>
            </li>
          ))}
        </ul>
        <InlineError error={confirm.error} />
        <Button
          block
          disabled={reviewing.length === 0}
          loading={confirm.isPending}
          onClick={() => confirm.mutate(base({ date: p?.date ?? a.date, items: reviewing.map((x) => ({ taskId: x.taskId, taskVersion: x.taskVersion, toUserId: x.toUserId })) }))}
        >
          {t("admin.team.confirm", { count: reviewing.length })}
        </Button>
      </Sheet>
    </div>
  );
}

import { useMemo, useState } from "react";
import { Link } from "wouter";
import { ChevronLeft, ChevronRight, Lock } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { useBase } from "@/hooks/useMe";
import { PageHeader, Section } from "@/components/ui/Layout";
import { Button } from "@/components/ui/Button";
import { CheckRow, SelectInput, TextInput } from "@/components/ui/Fields";
import { EmptyState, ErrorState, InlineError, Loading } from "@/components/ui/States";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { PersonSelect } from "@/components/PersonSelect";
import { quantityText } from "@/components/WorkCard";

/* Dates are handled as YYYY-MM-DD strings; arithmetic runs in UTC so no time zone can shift a day. */
const toIso = (d: Date) => d.toISOString().slice(0, 10);
const fromIso = (s: string) => new Date(`${s}T00:00:00Z`);
const addDays = (s: string, n: number) => {
  const d = fromIso(s);
  d.setUTCDate(d.getUTCDate() + n);
  return toIso(d);
};
function localToday(): string {
  const d = new Date();
  return toIso(new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())));
}
function mondayOf(s: string): string {
  const day = fromIso(s).getUTCDay(); // 0 = Sunday
  return addDays(s, -((day + 6) % 7));
}

type DateMode = "keep" | "date" | "unplanned";

export default function Planning() {
  const { t, language } = useLanguage();
  const toast = useToast();
  const utils = trpc.useUtils();
  const base = useBase();
  const today = localToday();
  const [weekStart, setWeekStart] = useState(() => mondayOf(today));
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dateMode, setDateMode] = useState<DateMode>("keep");
  const [newDate, setNewDate] = useState(today);
  const [changePerson, setChangePerson] = useState(false);
  const [newPerson, setNewPerson] = useState<number | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const list = trpc.tasks.list.useQuery({ scope: "team" });
  const people = trpc.people.directory.useQuery();
  const plan = trpc.tasks.planMany.useMutation({
    onSuccess: (res) => {
      base.reset();
      toast(t("admin.planning.done", { count: res.planned }));
      setSelected(new Set());
      setConfirmOpen(false);
      setDateMode("keep");
      setChangePerson(false);
      void utils.tasks.list.invalidate();
      void utils.control.overview.invalidate();
    },
    onError: () => void utils.tasks.list.invalidate(),
  });

  const locale = language === "cs" ? "cs-CZ" : "de-DE";
  const fmt = (s: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "numeric" }) =>
    fromIso(s).toLocaleDateString(locale, { ...opts, timeZone: "UTC" });

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const weekEnd = addDays(weekStart, 6);

  if (list.isLoading) return <Loading />;
  if (list.error || !list.data) return <ErrorState error={list.error} onRetry={() => list.refetch()} />;

  const tasks = list.data;
  type Item = (typeof tasks)[number];
  const unplanned = tasks.filter((x) => x.plannedDate === null && x.status === "open");
  const byDay = new Map(days.map((d) => [d, tasks.filter((x) => x.plannedDate === d)]));
  const otherWeeks = tasks.filter((x) => x.plannedDate !== null && (x.plannedDate < weekStart || x.plannedDate > weekEnd)).length;
  // Only open tasks that are still in the list can be planned.
  const chosen = tasks.filter((x) => selected.has(x.id) && x.status === "open");

  const toggle = (id: string, on: boolean) =>
    setSelected((cur) => {
      const next = new Set(cur);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const nameOf = (id: number | null) => (id === null ? t("app.unassigned") : (people.data?.find((p) => p.id === id)?.displayName ?? t("app.none")));
  const dateText = (d: string | null) => (d === null ? t("admin.planning.unplanned") : fmt(d, { weekday: "short", day: "numeric", month: "numeric", year: "numeric" }));
  const targetDate: string | null | undefined = dateMode === "keep" ? undefined : dateMode === "unplanned" ? null : newDate || undefined;
  const hasChange = targetDate !== undefined || changePerson;

  const submit = () =>
    plan.mutate(
      base({
        items: chosen.map((x) => ({ taskId: x.id, version: x.version })),
        ...(targetDate !== undefined ? { plannedDate: targetDate } : {}),
        ...(changePerson ? { assigneeId: newPerson } : {}),
      }),
    );

  const row = (x: Item) => {
    const open = x.status === "open";
    const meta = [x.reference, quantityText(t, x.quantity, x.unit), x.assigneeName ?? t("app.unassigned")].filter(Boolean).join(" · ");
    return (
      <div key={x.id} className={`flex items-start gap-3 rounded-2xl bg-white p-3 shadow-sm ${selected.has(x.id) ? "ring-2 ring-brand" : ""}`}>
        {open ? (
          <input
            type="checkbox"
            className="mt-1 size-7 shrink-0 accent-brand"
            aria-label={t("admin.planning.select", { name: x.product })}
            checked={selected.has(x.id)}
            onChange={(e) => toggle(x.id, e.target.checked)}
          />
        ) : (
          <Lock className="mt-1 size-6 shrink-0 text-slate-500" aria-hidden />
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <Link href={`/aufgabe/${x.id}`} className="text-lg font-semibold leading-tight underline-offset-2 hover:underline">
            {x.product}
          </Link>
          <p className="text-sm text-slate-600">{meta}</p>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={x.status} />
            {!open && <span className="text-sm font-medium text-slate-700">{t("admin.planning.locked")}</span>}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={`flex flex-col gap-6 ${chosen.length > 0 ? "pb-40" : ""}`}>
      <PageHeader title={t("nav.item.planning")} coordination />

      <div className="flex items-center gap-2">
        <Button variant="secondary" aria-label={t("admin.planning.prevWeek")} onClick={() => setWeekStart(addDays(weekStart, -7))} icon={<ChevronLeft aria-hidden />} className="px-3" />
        <div className="flex flex-1 flex-col items-center text-center">
          <span className="font-semibold">
            {fmt(weekStart, { day: "numeric", month: "numeric" })} – {fmt(weekEnd, { day: "numeric", month: "numeric", year: "numeric" })}
          </span>
          {weekStart !== mondayOf(today) && (
            <button type="button" className="min-h-11 px-2 text-sm font-medium text-slate-600 underline" onClick={() => setWeekStart(mondayOf(today))}>
              {t("admin.planning.thisWeek")}
            </button>
          )}
        </div>
        <Button variant="secondary" aria-label={t("admin.planning.nextWeek")} onClick={() => setWeekStart(addDays(weekStart, 7))} icon={<ChevronRight aria-hidden />} className="px-3" />
      </div>

      {tasks.length === 0 && <EmptyState text={t("admin.planning.empty")} />}

      {unplanned.length > 0 && <Section title={`${t("admin.planning.unplanned")} (${unplanned.length})`}>{unplanned.map(row)}</Section>}

      {days.map((d) => {
        const items = byDay.get(d) ?? [];
        return (
          <Section key={d} title={`${fmt(d)}${d === today ? ` · ${t("app.today")}` : ""}`}>
            {items.length === 0 ? <p className="text-sm text-slate-500">{t("admin.planning.dayEmpty")}</p> : items.map(row)}
          </Section>
        );
      })}

      {otherWeeks > 0 && <p className="text-sm text-slate-600">{t("admin.planning.otherWeeks", { count: otherWeeks })}</p>}

      {chosen.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-lg">
          <div className="mx-auto flex max-w-2xl flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold">{t("admin.planning.selected", { count: chosen.length })}</span>
              <Button variant="ghost" onClick={() => setSelected(new Set())}>
                {t("admin.planning.clear")}
              </Button>
            </div>
            <Button block onClick={() => setConfirmOpen(true)}>
              {t("admin.reviewProposal")}
            </Button>
          </div>
        </div>
      )}

      <Sheet open={confirmOpen} onOpenChange={setConfirmOpen} title={t("admin.planning.confirmTitle")}>
        <SelectInput label={t("admin.planning.dateMode")} value={dateMode} onChange={(e) => setDateMode(e.target.value as DateMode)}>
          <option value="keep">{t("admin.planning.keep")}</option>
          <option value="date">{t("admin.planning.setDate")}</option>
          <option value="unplanned">{t("admin.planning.setUnplanned")}</option>
        </SelectInput>
        {dateMode === "date" && <TextInput label={t("admin.planning.date")} type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />}
        <CheckRow label={t("admin.planning.changePerson")} checked={changePerson} onChange={setChangePerson} />
        {changePerson && <PersonSelect label={t("admin.planning.person")} value={newPerson} onChange={setNewPerson} />}

        {!hasChange ? (
          <p className="rounded-lg bg-slate-100 p-3 text-sm font-medium">{t("admin.planning.chooseChange")}</p>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="font-medium">{t("admin.planning.confirmIntro")}</p>
            <ul className="flex flex-col gap-2">
              {chosen.map((x) => (
                <li key={x.id} className="rounded-xl border border-slate-200 p-3">
                  <p className="font-semibold">{x.product}</p>
                  <p className="text-sm text-slate-600">{x.reference}</p>
                  {targetDate !== undefined && <p className="text-sm">{t("admin.planning.dateChange", { from: dateText(x.plannedDate), to: dateText(targetDate) })}</p>}
                  {changePerson && <p className="text-sm">{t("admin.planning.personChange", { from: x.assigneeName ?? t("app.unassigned"), to: nameOf(newPerson) })}</p>}
                </li>
              ))}
            </ul>
            <p className="text-sm text-slate-600">{t("admin.planning.onlyLocal")}</p>
          </div>
        )}
        <InlineError error={plan.error} />
        <Button block onClick={submit} disabled={!hasChange || chosen.length === 0} loading={plan.isPending}>
          {t("admin.planning.confirm", { count: chosen.length })}
        </Button>
      </Sheet>
    </div>
  );
}

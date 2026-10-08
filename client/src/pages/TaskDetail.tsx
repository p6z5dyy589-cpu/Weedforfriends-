import { useEffect, useState } from "react";
import { Link, useSearch } from "wouter";
import { MessageCircle } from "lucide-react";
import { PROCESS_STEPS, stepIndex } from "@shared/tasks";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { useBase, useMe } from "@/hooks/useMe";
import type { TaskView } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Card, PageHeader } from "@/components/ui/Layout";
import { ErrorState, InlineError, Loading } from "@/components/ui/States";
import { LocalBadge, StatusBadge } from "@/components/ui/StatusBadge";
import { Sheet } from "@/components/ui/Sheet";
import { TextArea, TextInput } from "@/components/ui/Fields";
import { PersonSelect } from "@/components/PersonSelect";
import { quantityText } from "@/components/WorkCard";
import { formatDate } from "@/components/TaskRow";
import { PhotoEditor, PhotoGallery } from "@/components/task/Photos";
import { MaterialSummary, WorkForm } from "@/components/task/WorkForm";
import { ReviewSheet } from "@/components/task/ReviewSheet";
import { StopCard } from "@/components/task/StopCard";
import { PackingPanel } from "@/components/task/PackingPanel";
import { IncomingPanel } from "@/components/task/IncomingPanel";
import { ReportSheet } from "@/components/task/ReportSheet";

/** Muster B - "Schritt x von y". Progress never pretends an Odoo success. */
function Steps({ task }: { task: TaskView }) {
  const { t } = useLanguage();
  const steps = PROCESS_STEPS[task.data.processType];
  const current = stepIndex(task.data);
  return (
    <div>
      <p className="mb-2 text-sm font-medium text-slate-600">{t("task.step", { current: current + 1, total: steps.length })}</p>
      <ol className="flex gap-1" aria-hidden>
        {steps.map((s, i) => (
          <li key={s} className={`h-2 flex-1 rounded-full ${i <= current ? "bg-brand" : "bg-slate-200"}`} />
        ))}
      </ol>
    </div>
  );
}

function ProductionPanel({ task, refresh }: { task: TaskView; refresh: () => void }) {
  const { t, tx } = useLanguage();
  const base = useBase();
  const start = trpc.tasks.start.useMutation({ onSuccess: () => (base.reset(), refresh()) });
  const submit = trpc.tasks.submit.useMutation({ onSuccess: () => (base.reset(), refresh()) });
  const d = task.data;

  if (d.status === "open") {
    return (
      <div className="flex flex-col gap-3">
        <ol className="flex list-decimal flex-col gap-1 pl-5 text-slate-800">
          {(["1", "2", "3", "4"] as const).map((n) => (
            <li key={n}>{t(`task.guide.production.${n}`)}</li>
          ))}
        </ol>
        {task.dependency && !task.can.start && <p className="font-medium text-amber-800">{t("home.waitingDependency")}</p>}
        <InlineError error={start.error} />
        {task.can.start && (
          <Button block loading={start.isPending} onClick={() => start.mutate(base({ taskId: task.id, version: task.version }))}>
            {t("task.start.production")}
          </Button>
        )}
      </div>
    );
  }
  if (d.status === "in_progress" && task.can.editWork) {
    return (
      <div className="flex flex-col gap-5">
        {d.review?.decision === "returned" && (
          <p className="rounded-xl bg-amber-50 p-3 text-amber-900">
            {t("task.returned")} {d.review.note}
          </p>
        )}
        <section>
          <h3 className="mb-2 font-semibold">{t("task.photos")}</h3>
          <PhotoEditor taskId={task.id} version={task.version} fileIds={d.photoFileIds} onChanged={refresh} />
        </section>
        <WorkForm key={task.version} task={task} onSaved={refresh} />
        {task.checks.submit && task.checks.submit !== "wrong_status" && <p className="text-slate-700">{tx(`reason.${task.checks.submit}`, "app.error")}</p>}
        <InlineError error={submit.error} />
        <Button block disabled={!task.can.submit} loading={submit.isPending} onClick={() => submit.mutate(base({ taskId: task.id, version: task.version }))}>
          {t("task.submit")}
        </Button>
      </div>
    );
  }
  if (d.status === "review") {
    if (task.can.review) return <ReviewSheet key={task.version} task={task} onDone={refresh} />;
    return (
      <div className="flex flex-col gap-3">
        <p className="rounded-xl bg-amber-50 p-3 font-medium text-amber-900">{t("task.submitted")}</p>
        <PhotoGallery fileIds={d.photoFileIds} />
        <MaterialSummary task={task} />
      </div>
    );
  }
  if (d.status === "approved") {
    return (
      <div className="flex flex-col gap-3">
        <p className="rounded-xl bg-emerald-50 p-3 font-medium text-emerald-900">{t("task.approved")}</p>
        <PhotoGallery fileIds={d.photoFileIds} />
        <MaterialSummary task={task} />
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <PhotoGallery fileIds={d.photoFileIds} />
      {d.material.length > 0 && <MaterialSummary task={task} />}
    </div>
  );
}

function SimplePanel({ task, refresh }: { task: TaskView; refresh: () => void }) {
  const { t } = useLanguage();
  const base = useBase();
  const start = trpc.tasks.start.useMutation({ onSuccess: () => (base.reset(), refresh()) });
  const complete = trpc.tasks.complete.useMutation({ onSuccess: () => (base.reset(), refresh()) });
  const startLabel = task.data.processType === "incoming" ? t("task.start.incoming") : t("task.start.general");
  return (
    <div className="flex flex-col gap-3">
      <InlineError error={start.error ?? complete.error} />
      {task.can.start && (
        <Button block loading={start.isPending} onClick={() => start.mutate(base({ taskId: task.id, version: task.version }))}>
          {startLabel}
        </Button>
      )}
      {task.can.complete && (
        <Button block loading={complete.isPending} onClick={() => complete.mutate(base({ taskId: task.id, version: task.version }))}>
          {t("task.complete")}
        </Button>
      )}
    </div>
  );
}

function PlanSection({ task, refresh }: { task: TaskView; refresh: () => void }) {
  const { t } = useLanguage();
  const base = useBase();
  const [assignee, setAssignee] = useState<number | null>(task.data.assigneeId);
  const [date, setDate] = useState(task.data.plannedDate ?? "");
  const plan = trpc.tasks.plan.useMutation({ onSuccess: () => (base.reset(), refresh()) });
  return (
    <Card>
      <h3 className="mb-2 font-semibold">{t("nav.item.planning")}</h3>
      <div className="flex flex-col gap-3">
        <PersonSelect label={t("task.responsible")} value={assignee} onChange={setAssignee} />
        <TextInput label={t("task.plannedDate")} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <InlineError error={plan.error} />
        <Button
          variant="secondary"
          disabled={assignee === task.data.assigneeId && date === (task.data.plannedDate ?? "")}
          loading={plan.isPending}
          onClick={() => plan.mutate(base({ taskId: task.id, version: task.version, assigneeId: assignee, plannedDate: date || null, sequence: task.data.sequence }))}
        >
          {t("app.save")}
        </Button>
      </div>
    </Card>
  );
}

function History({ id }: { id: string }) {
  const { t, language } = useLanguage();
  const history = trpc.tasks.history.useQuery({ id });
  if (history.isLoading) return <Loading />;
  if (history.error) return <ErrorState error={history.error} />;
  const fmt = new Intl.DateTimeFormat(language === "cs" ? "cs-CZ" : "de-DE", { dateStyle: "short", timeStyle: "short" });
  return (
    <ol className="flex flex-col gap-2">
      {history.data?.map((e) => (
        <li key={e.id} className="border-l-2 border-slate-300 pl-3">
          <p className="text-sm text-slate-500">
            {fmt.format(e.at)} · {e.actorName ?? t("app.none")}
          </p>
          <p>{e.to ? t(`status.${e.to}`) : t("task.details")}</p>
        </li>
      ))}
    </ol>
  );
}

export default function TaskDetail({ id }: { id: string }) {
  const { t, language } = useLanguage();
  const me = useMe();
  const search = useSearch();
  const utils = trpc.useUtils();
  const task = trpc.tasks.get.useQuery({ id });
  const [reportOpen, setReportOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelNote, setCancelNote] = useState("");
  const base = useBase();
  const cancel = trpc.tasks.cancel.useMutation({ onSuccess: () => (base.reset(), setCancelOpen(false), refresh()) });

  const refresh = () => {
    void utils.tasks.invalidate();
    void utils.today.invalidate();
    void utils.notifications.invalidate();
  };

  useEffect(() => {
    if (new URLSearchParams(search).get("problem") === "1" && task.data?.can.report) setReportOpen(true);
  }, [search, task.data?.can.report]);

  if (task.isLoading) return <Loading />;
  if (task.error || !task.data) return <ErrorState error={task.error} onRetry={() => task.refetch()} />;
  const v = task.data;
  const d = v.data;
  if (v.companyId !== me.activeCompanyId) return <ErrorState error={{ data: { code: "NOT_FOUND" } }} />;
  const company = me.companies.find((c) => c.id === v.companyId)?.name;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={d.product} back="/" />
      <div className="-mt-3 flex flex-wrap items-center gap-2">
        <StatusBadge status={d.status} />
        <LocalBadge />
      </div>
      <Card>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
          <dt className="text-slate-500">{t("company.label")}</dt>
          <dd>{company}</dd>
          <dt className="text-slate-500">{t("task.reference")}</dt>
          <dd>{d.reference}</dd>
          {d.quantity !== null && (
            <>
              <dt className="text-slate-500">{t("task.quantity")}</dt>
              <dd>{quantityText(t, d.quantity, d.unit)}</dd>
            </>
          )}
          <dt className="text-slate-500">{t("task.responsible")}</dt>
          <dd>{v.assigneeName ?? t("app.unassigned")}</dd>
          {d.plannedDate && (
            <>
              <dt className="text-slate-500">{t("task.plannedDate")}</dt>
              <dd>{formatDate(d.plannedDate, language)}</dd>
            </>
          )}
          {v.dependency && (
            <>
              <dt className="text-slate-500">{t("task.dependency")}</dt>
              <dd>
                <Link href={`/aufgabe/${v.dependency.id}`} className="underline">
                  {t(`process.${v.dependency.processType}`)}: {v.dependency.product}
                </Link>{" "}
                <span className="text-sm">({t(`status.${v.dependency.status}`)})</span>
              </dd>
            </>
          )}
        </dl>
      </Card>

      {d.status === "blocked" ? (
        <StopCard task={v} onChanged={refresh} />
      ) : (
        <Card>
          <div className="mb-4">
            <Steps task={v} />
          </div>
          {(d.processType === "production" || d.processType === "packaging") && <ProductionPanel task={v} refresh={refresh} />}
          {d.processType === "packing" && <PackingPanel task={v} onChanged={refresh} />}
          {d.processType === "incoming" && (d.status === "open" ? <SimplePanel task={v} refresh={refresh} /> : <IncomingPanel task={v} onChanged={refresh} />)}
          {d.processType === "general" && <SimplePanel task={v} refresh={refresh} />}
        </Card>
      )}

      {v.can.report && (
        <Button variant="stop" block onClick={() => setReportOpen(true)}>
          {t("task.report")}
        </Button>
      )}

      {v.can.plan && <PlanSection key={v.version} task={v} refresh={refresh} />}

      <div className="flex flex-col gap-2">
        <Link href={`/chat/${encodeURIComponent(`task:${v.id}`)}`} className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white font-semibold">
          <MessageCircle className="size-5" aria-hidden />
          {t("task.chat")}
        </Link>
        <Button variant="ghost" onClick={() => setDetailsOpen(true)}>
          {t("task.history")}
        </Button>
        {v.can.cancel && (
          <Button variant="ghost" className="text-stop" onClick={() => setCancelOpen(true)}>
            {t("task.cancel")}
          </Button>
        )}
      </div>
      <p className="text-sm text-slate-500">{t("task.notInOdoo")}</p>

      <ReportSheet task={v} open={reportOpen} onOpenChange={setReportOpen} onDone={refresh} />
      <Sheet open={detailsOpen} onOpenChange={setDetailsOpen} title={t("task.history")}>
        {detailsOpen && <History id={v.id} />}
      </Sheet>
      <Sheet open={cancelOpen} onOpenChange={setCancelOpen} title={t("task.cancel")}>
        <TextArea label={t("task.cancel.note")} value={cancelNote} maxLength={1000} onChange={(e) => setCancelNote(e.target.value)} />
        <InlineError error={cancel.error} />
        <Button block variant="danger" disabled={!cancelNote.trim()} loading={cancel.isPending} onClick={() => cancel.mutate(base({ taskId: v.id, version: v.version, note: cancelNote }))}>
          {t("task.cancel")}
        </Button>
      </Sheet>
    </div>
  );
}

import type { ReactNode } from "react";
import { Link } from "wouter";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../server/routers";
import { useLanguage } from "@/contexts/LanguageContext";
import type { TranslationKey } from "@/i18n";
import { quantityText } from "./WorkCard";
import { StatusBadge } from "./ui/StatusBadge";

export type TaskListItem = inferRouterOutputs<AppRouter>["tasks"]["list"][number];

export function formatDate(iso: string, language: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(language === "cs" ? "cs-CZ" : "de-DE");
}

/** Compact list row; the whole row opens the task. Optional extra content below (e.g. a primary action). */
export function TaskRow({ task, children }: { task: TaskListItem; children?: ReactNode }) {
  const { t, language } = useLanguage();
  const sub = [task.reference, quantityText(t, task.quantity, task.unit)].filter(Boolean).join(" · ");
  return (
    <article className="flex flex-col gap-2 rounded-2xl bg-white shadow-sm">
      <Link href={`/aufgabe/${task.id}`} className="flex min-h-11 flex-col gap-1 rounded-2xl p-4 hover:bg-slate-50">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <p className="font-semibold leading-tight">{task.product}</p>
          <StatusBadge status={task.status} />
        </div>
        {sub && <p className="text-sm text-slate-600">{sub}</p>}
        <p className="text-sm text-slate-600">
          {t("task.responsible")}: {task.assigneeName ?? t("app.unassigned")}
          {task.plannedDate && <> · {t("flow.list.planned", { date: formatDate(task.plannedDate, language) })}</>}
        </p>
        {task.status === "blocked" && task.blockReason && <p className="text-sm font-medium text-stop">{t(`block.${task.blockReason}` as TranslationKey)}</p>}
      </Link>
      {children && <div className="px-4 pb-4">{children}</div>}
    </article>
  );
}

export function TaskRows({ tasks, renderExtra }: { tasks: TaskListItem[]; renderExtra?: (task: TaskListItem) => ReactNode }) {
  return (
    <ul className="flex flex-col gap-2">
      {tasks.map((task) => (
        <li key={task.id}>
          <TaskRow task={task}>{renderExtra?.(task)}</TaskRow>
        </li>
      ))}
    </ul>
  );
}

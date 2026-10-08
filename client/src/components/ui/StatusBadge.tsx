import { ArrowRightLeft, BadgeCheck, Circle, Hourglass, OctagonAlert, Package, PlayCircle, XCircle } from "lucide-react";
import type { TaskStatus } from "@shared/tasks";
import { useLanguage } from "@/contexts/LanguageContext";

const ICONS: Record<TaskStatus, typeof Circle> = {
  open: Circle,
  in_progress: PlayCircle,
  review: Hourglass,
  approved: BadgeCheck,
  handover_offered: ArrowRightLeft,
  packing: Package,
  packed: BadgeCheck,
  checked: BadgeCheck,
  done: BadgeCheck,
  blocked: OctagonAlert,
  cancelled: XCircle,
};

const TONE: Record<TaskStatus, string> = {
  open: "bg-slate-100 text-slate-700",
  in_progress: "bg-blue-50 text-blue-800",
  review: "bg-amber-50 text-amber-800",
  approved: "bg-emerald-50 text-emerald-800",
  handover_offered: "bg-amber-50 text-amber-800",
  packing: "bg-blue-50 text-blue-800",
  packed: "bg-emerald-50 text-emerald-800",
  checked: "bg-emerald-50 text-emerald-800",
  done: "bg-emerald-50 text-emerald-800",
  blocked: "bg-red-50 text-stop",
  cancelled: "bg-slate-100 text-slate-500",
};

/** Status is never shown by color alone: always icon + text. */
export function StatusBadge({ status }: { status: TaskStatus }) {
  const { t } = useLanguage();
  const Icon = ICONS[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-medium ${TONE[status]}`}>
      <Icon className="size-4 shrink-0" aria-hidden />
      {t(`status.${status}`)}
    </span>
  );
}

export function LocalBadge() {
  const { t } = useLanguage();
  return (
    <span className="inline-flex items-center rounded-md border border-dashed border-slate-400 px-2 py-0.5 text-xs font-medium text-slate-600">
      {t("app.localOnly")}
    </span>
  );
}

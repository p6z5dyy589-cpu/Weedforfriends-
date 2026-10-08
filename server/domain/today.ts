import type { Role } from "@shared/roles";
import { dependencySatisfied, type TaskData } from "@shared/tasks";
import type { CardAction, TodayCard, TodayOverview } from "@shared/today";
import type { LocalRecord } from "../store/types";

interface Input {
  companyId: number;
  userId: number;
  roles: readonly Role[];
  tasks: LocalRecord<TaskData>[];
  names: Map<number, string>;
  /** YYYY-MM-DD of "today" in the plant's time zone. */
  today: string;
}

function actionFor(t: TaskData): CardAction {
  if (t.status === "blocked") return "openClarification";
  if (t.status === "handover_offered") return "acceptHandover";
  if (t.status === "packing") return "openPacklist";
  if (t.status === "review") return "viewDetails";
  if (t.processType === "incoming") return t.status === "in_progress" ? "continue" : "checkIncoming";
  if (t.status === "in_progress") return "continue";
  return "openTask";
}

/**
 * Start page hierarchy (handbook 4.1): one "now", at most two "next",
 * waiting cards without a second work button, and clarification cards.
 * "Labels ready" stays empty: it requires a real Odoo readback.
 */
export function buildToday(input: Input): TodayOverview {
  const { userId, roles, today } = input;
  const card = (r: LocalRecord<TaskData>): TodayCard => ({
    id: r.id,
    companyId: input.companyId,
    processType: r.data.processType,
    reference: r.data.reference,
    product: r.data.product,
    quantity: r.data.quantity,
    unit: r.data.unit,
    responsible: r.data.assigneeId ? (input.names.get(r.data.assigneeId) ?? null) : null,
    status: r.data.status,
    action: actionFor(r.data),
    ...(r.data.blocker ? { blockReason: r.data.blocker.reason } : {}),
    ...(blockedByDependency(r) ? { waitingFor: "dependency" as const, action: "viewDetails" as const } : {}),
  });

  const byId = new Map(input.tasks.map((r) => [r.id, r.data]));
  // A missing dependency is never treated as satisfied.
  const blockedByDependency = (r: LocalRecord<TaskData>) =>
    r.data.status === "open" && r.data.dependsOnTaskId !== null && !dependencySatisfied(byId.get(r.data.dependsOnTaskId) ?? ({ status: "open" } as TaskData));

  const mine = input.tasks.filter((r) => r.data.assigneeId === userId);
  const clarify = mine.filter((r) => r.data.status === "blocked");
  const waiting = [
    ...mine.filter((r) => r.data.status === "review"),
    ...input.tasks.filter((r) => r.data.status === "handover_offered" && r.data.handover?.offeredBy === userId && r.data.assigneeId !== userId),
    ...mine.filter((r) => r.data.processType !== "packing" && blockedByDependency(r)),
  ];

  const isPacker = roles.includes("pack");
  const handoversForMe = input.tasks.filter(
    (r) => r.data.status === "handover_offered" && isPacker && (r.data.assigneeId === userId || r.data.assigneeId === null),
  );
  const dueOpen = (r: LocalRecord<TaskData>) =>
    r.data.status === "open" &&
    r.data.processType !== "packing" &&
    !blockedByDependency(r) &&
    (r.data.plannedDate === null || r.data.plannedDate <= today);
  const byPlan = (a: LocalRecord<TaskData>, b: LocalRecord<TaskData>) =>
    (a.data.plannedDate ?? "0000").localeCompare(b.data.plannedDate ?? "0000") || a.data.sequence - b.data.sequence || a.createdAt.getTime() - b.createdAt.getTime();

  const actionable = [
    ...mine.filter((r) => r.data.status === "in_progress" || r.data.status === "packing").sort(byPlan),
    ...handoversForMe.sort(byPlan),
    ...mine.filter(dueOpen).sort(byPlan),
  ];
  const seen = new Set<string>();
  const unique = actionable.filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)));

  return {
    companyId: input.companyId,
    now: unique[0] ? card(unique[0]) : null,
    next: unique.slice(1, 3).map(card),
    waiting: waiting.map(card),
    labelsReady: [],
    clarify: clarify.map(card),
  };
}

/** Plant-local date (Europe/Berlin and Europe/Prague share the same offset). */
export function plantDate(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

/**
 * Local work packages ("Arbeitsplatz"). Everything here is local_unbooked:
 * a local status never means booked, reserved, paid, shipped or stored in
 * Odoo.
 */
export const TASK_SOURCE = "local_unbooked" as const;

export const PROCESS_TYPES = ["production", "packaging", "packing", "incoming", "general"] as const;
export type ProcessType = (typeof PROCESS_TYPES)[number];

/** Product families / kinds of work for the responsibility matrix (handbook 3.2). */
export const WORK_TYPES = ["flowers", "hash", "vapes", "packaging", "packing", "shipping", "incoming"] as const;
export type WorkType = (typeof WORK_TYPES)[number];

export const TASK_STATUSES = [
  "open", // not started
  "in_progress",
  "review", // waiting for reviewer (Vincent)
  "approved", // reviewed locally - Odoo completion still open
  "handover_offered", // packing: goods offered, not yet accepted
  "packing", // packing: accepted, checking lines
  "packed", // packing: all lines checked locally
  "checked", // incoming: checked locally - Odoo booking still open
  "done", // general work finished locally
  "blocked",
  "cancelled",
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const BLOCK_REASONS = ["material", "lot", "quantity", "photo", "damage", "dependency", "other"] as const;
export type BlockReason = (typeof BLOCK_REASONS)[number];

export const UNITS = ["g", "kg", "ml", "l", "pcs"] as const;
export type Unit = (typeof UNITS)[number];

export interface MaterialLine {
  id: string;
  component: string;
  lot: string;
  quantity: number | null;
  unit: Unit;
  /** Who entered it: the worker reports, the reviewer corrects. */
  source: "worker" | "reviewer";
}

export interface PackLine {
  id: string;
  product: string;
  quantity: number;
  unit: Unit;
  lotInfo: string;
  checked: boolean;
  checkedBy: number | null;
  deviation: string | null;
}

export interface IncomingCheck {
  deliveryNoteMatches: boolean | null;
  quantityMatches: boolean | null;
  qualityPhotoRequired: boolean;
  containerSize: string;
}

export interface TaskBlocker {
  reason: BlockReason;
  note: string;
  reportedBy: number;
  at: string;
  previousStatus: TaskStatus;
}

export interface TaskReview {
  reviewerId: number;
  at: string;
  decision: "approved" | "returned";
  note: string;
}

export interface TaskHandover {
  offeredBy: number;
  offeredAt: string;
  acceptedBy: number | null;
  acceptedAt: string | null;
}

export interface TaskData {
  processType: ProcessType;
  workType: WorkType | null;
  reference: string;
  product: string;
  quantity: number | null;
  unit: Unit;
  assigneeId: number | null;
  /** YYYY-MM-DD */
  plannedDate: string | null;
  sequence: number;
  status: TaskStatus;
  chainId: string | null;
  dependsOnTaskId: string | null;
  blocker: TaskBlocker | null;
  material: MaterialLine[];
  outputQuantity: number | null;
  zeroWaste: boolean;
  photoFileIds: string[];
  workerNote: string;
  review: TaskReview | null;
  handover: TaskHandover | null;
  packLines: PackLine[];
  incoming: IncomingCheck | null;
  createdBy: number;
}

export const ACTIVE_STATUSES: readonly TaskStatus[] = ["open", "in_progress", "review", "handover_offered", "packing", "blocked"];
export const TERMINAL_STATUSES: readonly TaskStatus[] = ["approved", "packed", "checked", "done", "cancelled"];

export function isTerminal(status: TaskStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

/** Planning may only touch work that has not started. */
export function isPlannable(status: TaskStatus): boolean {
  return status === "open";
}

/** Step list per process type for the guided view (Muster B). */
export const PROCESS_STEPS: Record<ProcessType, readonly TaskStatus[]> = {
  production: ["open", "in_progress", "review", "approved"],
  packaging: ["open", "in_progress", "review", "approved"],
  packing: ["open", "handover_offered", "packing", "packed"],
  incoming: ["open", "in_progress", "checked"],
  general: ["open", "in_progress", "done"],
};

export function stepIndex(task: Pick<TaskData, "processType" | "status" | "blocker">): number {
  const status = task.status === "blocked" && task.blocker ? task.blocker.previousStatus : task.status;
  return Math.max(0, PROCESS_STEPS[task.processType].indexOf(status));
}

/** Production-like tasks need a proof photo before review. */
export function canSubmitForReview(t: TaskData): string | null {
  if (t.processType !== "production" && t.processType !== "packaging") return "wrong_process";
  if (t.status !== "in_progress") return "wrong_status";
  if (t.photoFileIds.length === 0) return "photo_missing";
  if (t.outputQuantity === null && !t.zeroWaste) return "output_missing";
  return null;
}

export function canCompletePacking(t: TaskData): string | null {
  if (t.status !== "packing") return "wrong_status";
  if (t.packLines.length === 0) return "packlist_empty";
  if (t.packLines.some((l) => l.deviation)) return "deviation_open";
  if (t.packLines.some((l) => !l.checked)) return "packlist_incomplete";
  return null;
}

export function canCompleteIncoming(t: TaskData): string | null {
  if (t.processType !== "incoming" || !t.incoming) return "wrong_process";
  if (t.status !== "in_progress") return "wrong_status";
  if (t.incoming.deliveryNoteMatches !== true || t.incoming.quantityMatches !== true) return "check_incomplete";
  if (t.incoming.qualityPhotoRequired && t.photoFileIds.length === 0) return "photo_missing";
  return null;
}

/** Dependency (e.g. bulk before packaging) must be locally approved first. */
export function dependencySatisfied(dependency: TaskData | null): boolean {
  if (!dependency) return true;
  return dependency.status === "approved" || dependency.status === "packed" || dependency.status === "done" || dependency.status === "checked";
}

/** Standardised copy text for a local Goods-Out note. Never sent anywhere. */
export function slackOutText(t: Pick<TaskData, "reference" | "packLines">, companyName: string): string {
  const lines = t.packLines.map((l) => `• ${l.product}: ${l.quantity} ${l.unit}${l.lotInfo ? ` (${l.lotInfo})` : ""}`);
  return [
    `Goods-Out (LOKAL, nicht Odoo-validiert) · ${companyName} · ${t.reference}`,
    ...lines,
    "Status: lokal gepackt – Versand erst nach Odoo-Validierung.",
  ].join("\n");
}

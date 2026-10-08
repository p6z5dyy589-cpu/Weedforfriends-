import type { TaskData, WorkType } from "./tasks";

export const ATTENDANCE = ["present", "absent", "unknown"] as const;
export type Attendance = (typeof ATTENDANCE)[number];

export interface AttendanceData {
  userId: number;
  date: string;
  status: Attendance;
}

export interface MatrixData {
  workType: WorkType;
  primaryUserId: number | null;
  deputyUserIds: number[];
}

export interface Proposal {
  taskId: string;
  taskVersion: number;
  fromUserId: number;
  toUserId: number;
}

export interface Clarification {
  taskId: string;
  userId: number;
  reason: "attendance_unknown" | "no_candidate";
}

interface TaskRef {
  id: string;
  version: number;
  data: Pick<TaskData, "status" | "assigneeId" | "plannedDate" | "workType">;
}

/**
 * Substitution suggestions (handbook 12): only not-started work of people
 * confirmed absent is proposed for reassignment. "Unknown" never changes
 * anything - it becomes a clarification. Running work always stays.
 */
export function proposeSubstitutions(input: {
  date: string;
  tasks: TaskRef[];
  attendance: ReadonlyMap<number, Attendance>;
  matrix: ReadonlyMap<WorkType, MatrixData>;
}): { proposals: Proposal[]; clarifications: Clarification[]; runningStays: string[] } {
  const status = (userId: number): Attendance => input.attendance.get(userId) ?? "unknown";
  const proposals: Proposal[] = [];
  const clarifications: Clarification[] = [];
  const runningStays: string[] = [];

  for (const t of input.tasks) {
    const from = t.data.assigneeId;
    if (from === null) continue;
    const due = t.data.plannedDate === null || t.data.plannedDate <= input.date;
    if (!due) continue;
    const s = status(from);
    if (t.data.status !== "open") {
      if (s === "absent" && ["in_progress", "review", "packing", "handover_offered"].includes(t.data.status)) runningStays.push(t.id);
      continue;
    }
    if (s === "present") continue;
    if (s === "unknown") {
      clarifications.push({ taskId: t.id, userId: from, reason: "attendance_unknown" });
      continue;
    }
    const entry = t.data.workType ? input.matrix.get(t.data.workType) : undefined;
    const candidates = entry ? [entry.primaryUserId, ...entry.deputyUserIds] : [];
    const to = candidates.find((c): c is number => c !== null && c !== from && status(c) === "present");
    if (to === undefined) clarifications.push({ taskId: t.id, userId: from, reason: "no_candidate" });
    else proposals.push({ taskId: t.id, taskVersion: t.version, fromUserId: from, toUserId: to });
  }
  return { proposals, clarifications, runningStays };
}

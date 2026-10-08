import { TRPCError } from "@trpc/server";
import type { CompanyId } from "@shared/companies";
import { hasAnyRole, type Role } from "@shared/roles";
import {
  canCompleteIncoming,
  canCompletePacking,
  canSubmitForReview,
  dependencySatisfied,
  isPlannable,
  type TaskData,
} from "@shared/tasks";
import type { LocalRecord, Store } from "../store/types";
import { notFound } from "../_core/mutation";

export type TaskRecord = LocalRecord<TaskData>;

export const REVIEW_ROLES: readonly Role[] = ["reviewer", "qm"];
export const PLAN_ROLES: readonly Role[] = ["planner", "coordinator"];
export const RESOLVE_ROLES: readonly Role[] = ["coordinator", "reviewer", "qm", "planner"];
export const OVERSIGHT_ROLES: readonly Role[] = ["coordinator", "planner", "reviewer", "qm"];

export interface Actor {
  userId: number;
  roles: readonly Role[];
}

/**
 * @param depAssigneeId assignee of the predecessor step: whoever produced it
 * may see the next step (to offer the handover).
 */
export function canViewTask(t: TaskData, a: Actor, depAssigneeId: number | null = null): boolean {
  if (hasAnyRole(a.roles, OVERSIGHT_ROLES)) return true;
  if (t.assigneeId === a.userId) return true;
  if (depAssigneeId !== null && depAssigneeId === a.userId) return true;
  if (t.processType === "packing" && hasAnyRole(a.roles, ["pack", "shipping"])) return true;
  if (t.processType === "incoming" && hasAnyRole(a.roles, ["incoming"])) return true;
  return false;
}

/** Loads a task of the active company the actor may see; otherwise NOT_FOUND (no existence leak). */
export async function loadTask(store: Store, companyId: CompanyId, id: string, a: Actor, version?: number): Promise<TaskRecord> {
  const rec = await store.getRecord<TaskData>(companyId, "task", id);
  if (!rec) notFound();
  const dep = rec.data.dependsOnTaskId ? await store.getRecord<TaskData>(companyId, "task", rec.data.dependsOnTaskId) : null;
  if (!canViewTask(rec.data, a, dep?.data.assigneeId ?? null)) notFound();
  if (version !== undefined && rec.version !== version) throw new TRPCError({ code: "CONFLICT", message: "version" });
  return rec;
}

/** Visibility for lists: resolves predecessor assignees from the same list. */
export function visibleTasks(all: TaskRecord[], a: Actor): TaskRecord[] {
  const assignee = new Map(all.map((r) => [r.id, r.data.assigneeId]));
  return all.filter((r) => canViewTask(r.data, a, r.data.dependsOnTaskId ? (assignee.get(r.data.dependsOnTaskId) ?? null) : null));
}

export async function loadDependency(store: Store, companyId: CompanyId, t: TaskData): Promise<TaskData | null> {
  if (!t.dependsOnTaskId) return null;
  const dep = await store.getRecord<TaskData>(companyId, "task", t.dependsOnTaskId);
  // A missing dependency is never treated as satisfied.
  return dep ? dep.data : ({ status: "open" } as TaskData);
}

export interface TaskPermissions {
  start: boolean;
  editWork: boolean;
  addPhoto: boolean;
  submit: boolean;
  review: boolean;
  offer: boolean;
  accept: boolean;
  checkLines: boolean;
  completePacking: boolean;
  editIncoming: boolean;
  completeIncoming: boolean;
  complete: boolean;
  report: boolean;
  resolve: boolean;
  plan: boolean;
  cancel: boolean;
}

/** Single source for "who may do what now". UI shows exactly these actions. */
export function permissions(t: TaskData, a: Actor, dep: TaskData | null, depAssigneeId: number | null): TaskPermissions {
  const mine = t.assigneeId === a.userId;
  const prodLike = t.processType === "production" || t.processType === "packaging";
  const depOk = dependencySatisfied(dep);
  const reviewer = hasAnyRole(a.roles, REVIEW_ROLES);
  const planner = hasAnyRole(a.roles, PLAN_ROLES);
  const coordinator = a.roles.includes("coordinator");
  return {
    start: mine && t.status === "open" && t.processType !== "packing" && depOk,
    editWork: (mine && prodLike && t.status === "in_progress") || (reviewer && prodLike && t.status === "review"),
    addPhoto: mine && t.status === "in_progress" && (prodLike || t.processType === "incoming"),
    submit: mine && canSubmitForReview(t) === null,
    review: reviewer && prodLike && t.status === "review",
    offer:
      t.processType === "packing" &&
      t.status === "open" &&
      depOk &&
      t.packLines.length > 0 &&
      (coordinator || (depAssigneeId !== null && depAssigneeId === a.userId) || (!t.dependsOnTaskId && a.roles.includes("production"))),
    accept: t.status === "handover_offered" && a.roles.includes("pack") && (t.assigneeId === null || mine),
    checkLines: mine && t.status === "packing",
    completePacking: mine && canCompletePacking(t) === null,
    editIncoming: mine && t.processType === "incoming" && t.status === "in_progress",
    completeIncoming: mine && canCompleteIncoming(t) === null,
    complete: mine && t.processType === "general" && t.status === "in_progress",
    report: (mine || hasAnyRole(a.roles, OVERSIGHT_ROLES)) && ["open", "in_progress", "review", "handover_offered", "packing"].includes(t.status),
    resolve: hasAnyRole(a.roles, RESOLVE_ROLES) && t.status === "blocked",
    plan: planner && isPlannable(t.status),
    cancel: planner && (t.status === "open" || t.status === "blocked"),
  };
}

export function require(allowed: boolean, reason = "not_allowed"): void {
  if (!allowed) throw new TRPCError({ code: "PRECONDITION_FAILED", message: reason });
}

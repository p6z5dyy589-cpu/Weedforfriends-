import { describe, expect, it } from "vitest";
import type { TaskData } from "@shared/tasks";
import type { LocalRecord } from "../store/types";
import { buildToday, plantDate } from "./today";

let n = 0;
function rec(p: Partial<TaskData>): LocalRecord<TaskData> {
  n++;
  const data = {
    processType: "production",
    workType: null,
    reference: `R${n}`,
    product: `P${n}`,
    quantity: 1,
    unit: "g",
    assigneeId: 1,
    plannedDate: null,
    sequence: 0,
    status: "open",
    chainId: null,
    dependsOnTaskId: null,
    blocker: null,
    material: [],
    outputQuantity: null,
    zeroWaste: false,
    photoFileIds: [],
    workerNote: "",
    review: null,
    handover: null,
    packLines: [],
    incoming: null,
    createdBy: 9,
    ...p,
  } as TaskData;
  return { id: `t${n}`, companyId: 1, kind: "task", version: 1, ownerUserId: data.assigneeId, parentId: null, data, createdAt: new Date(n), updatedAt: new Date(n) };
}

describe("buildToday", () => {
  const base = { companyId: 1, userId: 1, roles: ["production" as const], names: new Map([[1, "Jakub"]]), today: "2026-01-05" };

  it("running work comes first, then max. two next tasks", () => {
    const a = rec({ plannedDate: "2026-01-05", sequence: 1 });
    const b = rec({ status: "in_progress" });
    const c = rec({ plannedDate: "2026-01-05", sequence: 2 });
    const d = rec({ plannedDate: "2026-01-04" });
    const future = rec({ plannedDate: "2026-01-09" });
    const o = buildToday({ ...base, tasks: [a, b, c, d, future] });
    expect(o.now?.id).toBe(b.id);
    expect(o.now?.action).toBe("continue");
    expect(o.next.map((x) => x.id)).toEqual([d.id, a.id]);
  });

  it("separates waiting and clarification, never fills labels", () => {
    const r = rec({ status: "review" });
    const blocked = rec({ status: "blocked", blocker: { reason: "lot", note: "", reportedBy: 1, at: "", previousStatus: "in_progress" } });
    const approved = rec({ status: "approved" });
    const o = buildToday({ ...base, tasks: [r, blocked, approved] });
    expect(o.now).toBeNull();
    expect(o.waiting.map((x) => x.id)).toEqual([r.id]);
    expect(o.clarify).toMatchObject([{ id: blocked.id, blockReason: "lot", action: "openClarification" }]);
    expect(o.labelsReady).toEqual([]);
  });

  it("ignores other people's work", () => {
    const o = buildToday({ ...base, tasks: [rec({ assigneeId: 2 })] });
    expect(o.now).toBeNull();
  });

  it("uses the plant time zone for 'today'", () => {
    expect(plantDate(new Date("2026-01-05T23:30:00Z"))).toBe("2026-01-06");
  });
});

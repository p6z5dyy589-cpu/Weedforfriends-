import { describe, expect, it } from "vitest";
import { proposeSubstitutions, type Attendance, type MatrixData } from "./coordination";
import type { WorkType } from "./tasks";

const task = (id: string, assigneeId: number, status = "open", workType: WorkType | null = "flowers") => ({
  id,
  version: 1,
  data: { status: status as "open", assigneeId, plannedDate: null, workType },
});
const matrix = new Map<WorkType, MatrixData>([["flowers", { workType: "flowers", primaryUserId: 1, deputyUserIds: [2, 3] }]]);
const run = (tasks: ReturnType<typeof task>[], att: [number, Attendance][]) =>
  proposeSubstitutions({ date: "2026-01-05", tasks, attendance: new Map(att), matrix });

describe("substitution proposals", () => {
  it("'Nicht da' proposes the first present person of the matrix", () => {
    const r = run([task("t1", 1)], [[1, "absent"], [2, "unknown"], [3, "present"]]);
    expect(r.proposals).toEqual([{ taskId: "t1", taskVersion: 1, fromUserId: 1, toUserId: 3 }]);
  });

  it("'Unbekannt' never changes anything - only clarification", () => {
    const r = run([task("t1", 1)], [[2, "present"]]);
    expect(r.proposals).toEqual([]);
    expect(r.clarifications).toEqual([{ taskId: "t1", userId: 1, reason: "attendance_unknown" }]);
  });

  it("running work stays with its owner", () => {
    const r = run([task("t1", 1, "in_progress")], [[1, "absent"], [2, "present"]]);
    expect(r.proposals).toEqual([]);
    expect(r.runningStays).toEqual(["t1"]);
  });

  it("no present candidate → clarification", () => {
    const r = run([task("t1", 1), task("t2", 4, "open", null)], [[1, "absent"], [4, "absent"], [2, "absent"]]);
    expect(r.clarifications.map((c) => c.reason)).toEqual(["no_candidate", "no_candidate"]);
  });

  it("present people keep their work", () => {
    expect(run([task("t1", 1)], [[1, "present"]])).toEqual({ proposals: [], clarifications: [], runningStays: [] });
  });
});

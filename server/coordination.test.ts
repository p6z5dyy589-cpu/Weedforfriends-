import { describe, expect, it } from "vitest";
import { teamHarness } from "./test/fixtures";

const DATE = "2026-01-05";

describe("attendance, matrix and confirmed substitution", () => {
  it("proposes and moves only after deliberate confirmation", async () => {
    const t = await teamHarness();
    const coord = await t.h.as("coord");
    await coord.api.coordination.setMatrix(coord.m({ workType: "flowers", version: 0, primaryUserId: t.ids.jakub, deputyUserIds: [t.ids.hus] }));
    const { id } = await coord.api.tasks.create(
      coord.m({ processType: "production", workType: "flowers", reference: "MO-1", product: "Haze", quantity: 1, unit: "g", assigneeId: t.ids.jakub, plannedDate: DATE }),
    );
    let p = await coord.api.coordination.proposals({ date: DATE });
    expect(p.proposals).toEqual([]);
    expect(p.clarifications[0]).toMatchObject({ taskId: id, reason: "attendance_unknown" });

    await coord.api.coordination.setAttendance(coord.m({ date: DATE, userId: t.ids.jakub, status: "absent", version: 0 }));
    await coord.api.coordination.setAttendance(coord.m({ date: DATE, userId: t.ids.hus, status: "present", version: 0 }));
    p = await coord.api.coordination.proposals({ date: DATE });
    expect(p.proposals).toMatchObject([{ taskId: id, toUserId: t.ids.hus }]);
    // Proposal alone changes nothing.
    expect((await coord.api.tasks.get({ id })).data.assigneeId).toBe(t.ids.jakub);

    const item = p.proposals[0]!;
    await coord.api.coordination.confirmProposals(coord.m({ date: DATE, items: [{ taskId: id, taskVersion: item.taskVersion, toUserId: item.toUserId }] }));
    expect((await coord.api.tasks.get({ id })).data.assigneeId).toBe(t.ids.hus);
    const hus = await t.h.as("hus");
    expect((await hus.api.notifications.list()).map((n) => n.type)).toContain("task_assigned");
  });

  it("refuses confirmation to a person who is not confirmed present", async () => {
    const t = await teamHarness();
    const coord = await t.h.as("coord");
    const { id } = await coord.api.tasks.create(
      coord.m({ processType: "production", workType: "flowers", reference: "MO-1", product: "Haze", quantity: 1, unit: "g", assigneeId: t.ids.jakub, plannedDate: DATE }),
    );
    await coord.api.coordination.setAttendance(coord.m({ date: DATE, userId: t.ids.jakub, status: "absent", version: 0 }));
    await expect(coord.api.coordination.confirmProposals(coord.m({ date: DATE, items: [{ taskId: id, taskVersion: 1, toUserId: t.ids.hus }] }))).rejects.toMatchObject({
      message: "target_not_present",
    });
  });

  it("matrix is company-separated", async () => {
    const t = await teamHarness();
    const coord = await t.h.as("coord");
    await expect(coord.api.coordination.setMatrix(coord.m({ workType: "flowers", version: 0, primaryUserId: t.ids.xenon, deputyUserIds: [] }))).rejects.toMatchObject({
      message: "person_not_in_company",
    });
    await coord.api.coordination.setMatrix(coord.m({ workType: "flowers", version: 0, primaryUserId: t.ids.jakub, deputyUserIds: [] }));
    await coord.switchTo(2);
    const m2 = await coord.api.coordination.matrix();
    expect(m2.find((e) => e.workType === "flowers")?.primaryUserId).toBeNull();
  });

  it("production staff cannot see coordination", async () => {
    const t = await teamHarness();
    const jakub = await t.h.as("jakub");
    await expect(jakub.api.coordination.attendance({})).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(jakub.api.control.overview()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

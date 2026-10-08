import { describe, expect, it } from "vitest";
import { fakePhoto, teamHarness } from "./test/fixtures";

const prod = {
  processType: "production" as const,
  workType: "flowers" as const,
  reference: "MO-100",
  product: "Lemon Haze",
  quantity: 500,
  unit: "g" as const,
  plannedDate: null,
};

async function setup() {
  const t = await teamHarness();
  const coord = await t.h.as("coord");
  const jakub = await t.h.as("jakub");
  const vincent = await t.h.as("vincent");
  const { id } = await coord.api.tasks.create(coord.m({ ...prod, assigneeId: t.ids.jakub }));
  return { ...t, coord, jakub, vincent, id };
}

describe("production flow: paper → photo → Vincent (local)", () => {
  it("runs the full happy path and never claims Odoo completion", async () => {
    const { h, ids, jakub, vincent, id } = await setup();
    let task = await jakub.api.tasks.get({ id });
    expect(task.source).toBe("local_unbooked");
    expect(task.can.start).toBe(true);

    await jakub.api.tasks.start(jakub.m({ taskId: id, version: task.version }));
    task = await jakub.api.tasks.get({ id });
    expect(task.data.status).toBe("in_progress");

    await expect(jakub.api.tasks.submit(jakub.m({ taskId: id, version: task.version }))).rejects.toMatchObject({ message: "photo_missing" });

    const photo = fakePhoto(h.store, 1, ids.jakub);
    await jakub.api.tasks.addPhoto(jakub.m({ taskId: id, version: task.version, fileId: photo }));
    task = await jakub.api.tasks.get({ id });
    await jakub.api.tasks.saveWork(
      jakub.m({ taskId: id, version: task.version, material: [{ component: "Blüten Bulk", lot: "", quantity: 520, unit: "g" }], outputQuantity: 500, zeroWaste: false, workerNote: "" }),
    );
    task = await jakub.api.tasks.get({ id });
    await jakub.api.tasks.submit(jakub.m({ taskId: id, version: task.version }));

    // Worker now only waits; no second work button.
    task = await jakub.api.tasks.get({ id });
    expect(task.data.status).toBe("review");
    expect(Object.entries(task.can).filter(([k, v]) => v && k !== "report")).toEqual([]);
    expect((await jakub.api.today.overview()).waiting.map((c) => c.id)).toEqual([id]);

    // Vincent was notified and must not approve with a missing lot.
    expect((await vincent.api.notifications.list()).map((n) => n.type)).toContain("review_waiting");
    let review = await vincent.api.tasks.get({ id });
    await expect(vincent.api.tasks.review(vincent.m({ taskId: id, version: review.version, decision: "approved", note: "" }))).rejects.toMatchObject({
      message: "lot_missing",
    });

    await vincent.api.tasks.saveWork(
      vincent.m({ taskId: id, version: review.version, material: [{ component: "Blüten Bulk", lot: "L-77", quantity: 520, unit: "g" }], outputQuantity: 500, zeroWaste: false, workerNote: "ignored" }),
    );
    review = await vincent.api.tasks.get({ id });
    expect(review.data.material[0]!.source).toBe("reviewer");
    await vincent.api.tasks.review(vincent.m({ taskId: id, version: review.version, decision: "approved", note: "" }));

    task = await jakub.api.tasks.get({ id });
    expect(task.data.status).toBe("approved");
    // Labels need a real Odoo readback - never filled locally.
    expect((await jakub.api.today.overview()).labelsReady).toEqual([]);
    expect((await jakub.api.notifications.list()).map((n) => n.type)).toContain("review_approved");

    const history = await jakub.api.tasks.history({ id });
    expect(history.map((e) => e.type)).toEqual(["created", "started", "photo_added", "work_saved", "submitted", "material_corrected", "review_approved_local"]);
  });

  it("accepts 0-Verschnitt as explicit case instead of an output quantity", async () => {
    const { h, ids, jakub, id } = await setup();
    let v = (await jakub.api.tasks.get({ id })).version;
    await jakub.api.tasks.start(jakub.m({ taskId: id, version: v++ }));
    await jakub.api.tasks.addPhoto(jakub.m({ taskId: id, version: v++, fileId: fakePhoto(h.store, 1, ids.jakub) }));
    await expect(jakub.api.tasks.submit(jakub.m({ taskId: id, version: v }))).rejects.toMatchObject({ message: "output_missing" });
    await jakub.api.tasks.saveWork(jakub.m({ taskId: id, version: v++, material: [], outputQuantity: null, zeroWaste: true, workerNote: "" }));
    await jakub.api.tasks.submit(jakub.m({ taskId: id, version: v }));
    expect((await jakub.api.tasks.get({ id })).data.status).toBe("review");
  });

  it("is idempotent: a retried request does not apply twice", async () => {
    const { jakub, id, h } = await setup();
    const v = (await jakub.api.tasks.get({ id })).version;
    const input = jakub.m({ taskId: id, version: v });
    const first = await jakub.api.tasks.start(input);
    const second = await jakub.api.tasks.start(input);
    expect(second).toEqual(first);
    expect(h.store.events.filter((e) => e.subjectId === id && e.type === "started")).toHaveLength(1);
  });

  it("rejects stale versions", async () => {
    const { jakub, id } = await setup();
    const v = (await jakub.api.tasks.get({ id })).version;
    await jakub.api.tasks.start(jakub.m({ taskId: id, version: v }));
    await expect(jakub.api.tasks.report(jakub.m({ taskId: id, version: v, reason: "material", note: "x" }))).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("does not let workers act on foreign tasks or photos", async () => {
    const { h, ids, jakub, id } = await setup();
    const hus = await h.as("hus");
    await expect(hus.api.tasks.get({ id })).rejects.toMatchObject({ code: "NOT_FOUND" });
    const v = (await jakub.api.tasks.get({ id })).version;
    await jakub.api.tasks.start(jakub.m({ taskId: id, version: v }));
    const husPhoto = fakePhoto(h.store, 1, ids.hus);
    await expect(jakub.api.tasks.addPhoto(jakub.m({ taskId: id, version: v + 1, fileId: husPhoto }))).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("does not let workers approve their own work", async () => {
    const { h, ids, jakub, id } = await setup();
    let v = (await jakub.api.tasks.get({ id })).version;
    await jakub.api.tasks.start(jakub.m({ taskId: id, version: v++ }));
    await jakub.api.tasks.addPhoto(jakub.m({ taskId: id, version: v++, fileId: fakePhoto(h.store, 1, ids.jakub) }));
    await jakub.api.tasks.saveWork(jakub.m({ taskId: id, version: v++, material: [], outputQuantity: 1, zeroWaste: false, workerNote: "" }));
    await jakub.api.tasks.submit(jakub.m({ taskId: id, version: v++ }));
    await expect(jakub.api.tasks.review(jakub.m({ taskId: id, version: v, decision: "approved", note: "" }))).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });

  it("'Etwas passt nicht' blocks, notifies and is resolved by coordination", async () => {
    const { coord, jakub, id } = await setup();
    let v = (await jakub.api.tasks.get({ id })).version;
    await jakub.api.tasks.start(jakub.m({ taskId: id, version: v++ }));
    await jakub.api.tasks.report(jakub.m({ taskId: id, version: v++, reason: "lot", note: "Lot unleserlich" }));
    const overview = await jakub.api.today.overview();
    expect(overview.clarify.map((c) => c.id)).toEqual([id]);
    expect(overview.clarify[0]!.action).toBe("openClarification");
    expect((await coord.api.notifications.list()).map((n) => n.type)).toContain("task_blocked");
    await expect(jakub.api.tasks.resolve(jakub.m({ taskId: id, version: v, decision: "resume", note: "ok" }))).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    await coord.api.tasks.resolve(coord.m({ taskId: id, version: v, decision: "resume", note: "Lot geklärt" }));
    expect((await jakub.api.tasks.get({ id })).data.status).toBe("in_progress");
  });
});

describe("planning", () => {
  it("plans only not-started work", async () => {
    const { coord, jakub, ids, id } = await setup();
    let v = (await coord.api.tasks.get({ id })).version;
    await coord.api.tasks.plan(coord.m({ taskId: id, version: v++, assigneeId: ids.jakub, plannedDate: "2026-01-06", sequence: 2 }));
    await jakub.api.tasks.start(jakub.m({ taskId: id, version: v++ }));
    await expect(coord.api.tasks.plan(coord.m({ taskId: id, version: v, assigneeId: ids.hus, plannedDate: null, sequence: 0 }))).rejects.toMatchObject({
      message: "task_started",
    });
  });

  it("planMany is all-or-nothing", async () => {
    const { coord, jakub, ids, id } = await setup();
    const { id: id2 } = await coord.api.tasks.create(coord.m({ ...prod, reference: "MO-101", assigneeId: ids.jakub }));
    await jakub.api.tasks.start(jakub.m({ taskId: id2, version: 1 }));
    await expect(
      coord.api.tasks.planMany(coord.m({ items: [{ taskId: id, version: 1 }, { taskId: id2, version: 2 }], plannedDate: "2026-01-07" })),
    ).rejects.toMatchObject({ message: "task_started" });
    expect((await coord.api.tasks.get({ id })).data.plannedDate).toBeNull();
  });

  it("cannot assign a person of another company", async () => {
    const { coord, ids, id } = await setup();
    await expect(coord.api.tasks.plan(coord.m({ taskId: id, version: 1, assigneeId: ids.xenon, plannedDate: null, sequence: 0 }))).rejects.toMatchObject({
      message: "person_not_in_company",
    });
  });

  it("production staff cannot create tasks", async () => {
    const { jakub, ids } = await setup();
    await expect(jakub.api.tasks.create(jakub.m({ ...prod, assigneeId: ids.jakub }))).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });
});

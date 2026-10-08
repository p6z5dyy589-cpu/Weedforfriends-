import { describe, expect, it } from "vitest";
import { slackOutText } from "@shared/tasks";
import { fakePhoto, teamHarness } from "./test/fixtures";

async function approve(t: Awaited<ReturnType<typeof teamHarness>>, worker: Awaited<ReturnType<Awaited<ReturnType<typeof teamHarness>>["h"]["as"]>>, workerId: number, reviewer: typeof worker, id: string) {
  let v = (await worker.api.tasks.get({ id })).version;
  await worker.api.tasks.start(worker.m({ taskId: id, version: v++ }));
  await worker.api.tasks.addPhoto(worker.m({ taskId: id, version: v++, fileId: fakePhoto(t.h.store, 1, workerId) }));
  await worker.api.tasks.saveWork(worker.m({ taskId: id, version: v++, material: [{ component: "Bulk", lot: "B-1", quantity: 1, unit: "kg" }], outputQuantity: 100, zeroWaste: false, workerNote: "" }));
  await worker.api.tasks.submit(worker.m({ taskId: id, version: v++ }));
  await reviewer.api.tasks.review(reviewer.m({ taskId: id, version: v, decision: "approved", note: "" }));
}

describe("WFF chain: Bulk → Abpackung → Packen (local template)", () => {
  it("enforces the order and the two-step handover", async () => {
    const t = await teamHarness();
    const coord = await t.h.as("coord");
    const jakub = await t.h.as("jakub");
    const hus = await t.h.as("hus");
    const vincent = await t.h.as("vincent");
    const packer = await t.h.as("packer");

    const { ids } = await coord.api.tasks.createChain(
      coord.m({
        reference: "SO-555",
        bulkProduct: "Ketama Bulk",
        bulkQuantity: 2,
        bulkUnit: "kg",
        bulkWorkType: "hash",
        endProduct: "WFF Ketama 5g",
        endQuantity: 100,
        endUnit: "pcs",
        bulkAssigneeId: t.ids.jakub,
        packagingAssigneeId: t.ids.hus,
        packAssigneeId: null,
        plannedDate: null,
      }),
    );
    const [bulk, packaging, packing] = ids as [string, string, string];

    // Packaging cannot start before bulk is (locally) approved.
    await expect(hus.api.tasks.start(hus.m({ taskId: packaging, version: 1 }))).rejects.toMatchObject({ message: "dependency_open" });
    const husToday = await hus.api.today.overview();
    expect(husToday.now).toBeNull();
    expect(husToday.waiting[0]).toMatchObject({ id: packaging, waitingFor: "dependency", action: "viewDetails" });

    await approve(t, jakub, t.ids.jakub, vincent, bulk);
    await approve(t, hus, t.ids.hus, vincent, packaging);

    // Offer (step 1) is not acceptance; packer sees "accept" as the one action.
    await hus.api.tasks.offer(hus.m({ taskId: packing, version: 1 }));
    const packerToday = await packer.api.today.overview();
    expect(packerToday.now?.id).toBe(packing);
    expect(packerToday.now?.action).toBe("acceptHandover");
    expect((await hus.api.today.overview()).waiting.map((c) => c.id)).toContain(packing);

    await packer.api.tasks.accept(packer.m({ taskId: packing, version: 2, deviation: null }));
    let task = await packer.api.tasks.get({ id: packing });
    expect(task.data.status).toBe("packing");
    const line = task.data.packLines[0]!;

    await expect(packer.api.tasks.completePacking(packer.m({ taskId: packing, version: task.version }))).rejects.toMatchObject({ message: "packlist_incomplete" });
    await packer.api.tasks.checkLine(packer.m({ taskId: packing, version: task.version, lineId: line.id, checked: true, deviation: "nur 98 Stück" }));
    task = await packer.api.tasks.get({ id: packing });
    await expect(packer.api.tasks.completePacking(packer.m({ taskId: packing, version: task.version }))).rejects.toMatchObject({ message: "deviation_open" });
    await packer.api.tasks.checkLine(packer.m({ taskId: packing, version: task.version, lineId: line.id, checked: true, deviation: null }));
    task = await packer.api.tasks.get({ id: packing });
    await packer.api.tasks.completePacking(packer.m({ taskId: packing, version: task.version }));
    task = await packer.api.tasks.get({ id: packing });
    expect(task.data.status).toBe("packed");

    const ready = await coord.api.tasks.list({ scope: "ready" });
    expect(ready.map((r) => r.id)).toEqual([packing]);
    const text = slackOutText(task.data, "Solovya");
    expect(text).toContain("LOKAL, nicht Odoo-validiert");
    expect(text).toContain("WFF Ketama 5g: 100 pcs");
  });

  it("a deviation at acceptance blocks instead of opening the packing task", async () => {
    const t = await teamHarness();
    const coord = await t.h.as("coord");
    const packer = await t.h.as("packer");
    const { id } = await coord.api.tasks.create(
      coord.m({ processType: "packing", workType: "packing", reference: "SO-1", product: "Box", quantity: 1, unit: "pcs", assigneeId: null, plannedDate: null, packLines: [{ product: "A", quantity: 1, unit: "pcs", lotInfo: "" }] }),
    );
    await coord.api.tasks.offer(coord.m({ taskId: id, version: 1 }));
    await packer.api.tasks.accept(packer.m({ taskId: id, version: 2, deviation: "Karton beschädigt" }));
    const task = await coord.api.tasks.get({ id });
    expect(task.data.status).toBe("blocked");
    expect(task.data.blocker?.previousStatus).toBe("handover_offered");
    await coord.api.tasks.resolve(coord.m({ taskId: id, version: task.version, decision: "resume", note: "neu verpackt" }));
    expect((await coord.api.tasks.get({ id })).data.status).toBe("handover_offered");
  });

  it("offer needs a packlist", async () => {
    const t = await teamHarness();
    const coord = await t.h.as("coord");
    const { id } = await coord.api.tasks.create(
      coord.m({ processType: "packing", workType: "packing", reference: "SO-2", product: "Box", quantity: 1, unit: "pcs", assigneeId: null, plannedDate: null }),
    );
    await expect(coord.api.tasks.offer(coord.m({ taskId: id, version: 1 }))).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });
});

describe("incoming goods (local check)", () => {
  it("requires both checks and the quality photo; result is never an Odoo booking", async () => {
    const t = await teamHarness();
    const coord = await t.h.as("coord");
    const recvId = await t.h.addUser({ loginName: "recv", grants: [[1, ["incoming"]]] });
    const recv = await t.h.as("recv");
    const { id } = await coord.api.tasks.create(
      coord.m({ processType: "incoming", workType: "incoming", reference: "WE-9", product: "Pods", quantity: 1000, unit: "pcs", assigneeId: recvId, plannedDate: null, qualityPhotoRequired: true }),
    );
    let v = 1;
    await recv.api.tasks.start(recv.m({ taskId: id, version: v++ }));
    await recv.api.tasks.saveIncoming(recv.m({ taskId: id, version: v++, deliveryNoteMatches: true, quantityMatches: true, containerSize: "10er" }));
    await expect(recv.api.tasks.completeIncoming(recv.m({ taskId: id, version: v }))).rejects.toMatchObject({ message: "photo_missing" });
    await recv.api.tasks.addPhoto(recv.m({ taskId: id, version: v++, fileId: fakePhoto(t.h.store, 1, recvId) }));
    await recv.api.tasks.completeIncoming(recv.m({ taskId: id, version: v }));
    expect((await recv.api.tasks.get({ id })).data.status).toBe("checked");
  });

  it("partial quantity cannot be completed - it needs clarification", async () => {
    const t = await teamHarness();
    const coord = await t.h.as("coord");
    const recvId = await t.h.addUser({ loginName: "recv", grants: [[1, ["incoming"]]] });
    const recv = await t.h.as("recv");
    const { id } = await coord.api.tasks.create(
      coord.m({ processType: "incoming", workType: "incoming", reference: "WE-10", product: "Pods", quantity: 1000, unit: "pcs", assigneeId: recvId, plannedDate: null }),
    );
    await recv.api.tasks.start(recv.m({ taskId: id, version: 1 }));
    await recv.api.tasks.saveIncoming(recv.m({ taskId: id, version: 2, deliveryNoteMatches: true, quantityMatches: false, containerSize: "" }));
    await expect(recv.api.tasks.completeIncoming(recv.m({ taskId: id, version: 3 }))).rejects.toMatchObject({ message: "check_incomplete" });
    await recv.api.tasks.report(recv.m({ taskId: id, version: 3, reason: "quantity", note: "nur 800 geliefert" }));
    expect((await recv.api.tasks.get({ id })).data.status).toBe("blocked");
  });
});

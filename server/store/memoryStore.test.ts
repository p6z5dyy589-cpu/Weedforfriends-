import { describe, expect, it } from "vitest";
import { MemoryStore } from "./memoryStore";
import { DuplicateRequestError, VersionConflictError, type LocalRecord } from "./types";

const rec = (id: string, version = 1): LocalRecord => ({
  id,
  companyId: 1,
  kind: "task",
  version,
  ownerUserId: null,
  parentId: null,
  data: { v: id },
  createdAt: new Date(),
  updatedAt: new Date(),
});

describe("MemoryStore.commit", () => {
  it("is atomic: a failing update leaves creates and events unapplied", async () => {
    const s = new MemoryStore();
    await s.commit({ companyId: 1, request: null, creates: [rec("a")] });
    await expect(
      s.commit({
        companyId: 1,
        request: { requestId: "r1", actorUserId: 1, procedure: "p" },
        creates: [rec("b")],
        updates: [{ record: rec("a"), expectedVersion: 7 }],
        events: [{ id: "e", companyId: 1, subject: "task", subjectId: "a", type: "x", actorUserId: 1, requestId: "r1", payload: null, createdAt: new Date() }],
      }),
    ).rejects.toBeInstanceOf(VersionConflictError);
    expect(s.records.has("b")).toBe(false);
    expect(s.events).toEqual([]);
    expect(await s.findRequest(1, "r1")).toBeNull();
  });

  it("rejects duplicate request ids", async () => {
    const s = new MemoryStore();
    await s.commit({ companyId: 1, request: { requestId: "r", actorUserId: 1, procedure: "p" }, result: () => 42 });
    expect((await s.findRequest(1, "r"))?.result).toBe(42);
    await expect(s.commit({ companyId: 1, request: { requestId: "r", actorUserId: 1, procedure: "p" } })).rejects.toBeInstanceOf(DuplicateRequestError);
    // Same request id in the other company is independent.
    await s.commit({ companyId: 2, request: { requestId: "r", actorUserId: 1, procedure: "p" } });
  });

  it("never returns records of another company", async () => {
    const s = new MemoryStore();
    await s.commit({ companyId: 1, request: null, creates: [rec("a")] });
    expect(await s.getRecord(2, "task", "a")).toBeNull();
    expect(await s.listRecords(2, "task")).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";
import {
  DuplicateRequestError,
  LoginNameTakenError,
  NEW_USER_ID,
  VersionConflictError,
  type LocalRecord,
  type Store,
} from "./types";

/** Shared behaviour every Store implementation must satisfy. */
export function storeContract(name: string, make: () => Promise<Store>) {
  const rec = (id: string, companyId: 1 | 2 = 1, extra: Partial<LocalRecord> = {}): LocalRecord => ({
    id,
    companyId,
    kind: "task",
    version: 1,
    ownerUserId: null,
    parentId: null,
    data: { name: id, nested: { ok: true } },
    createdAt: new Date(),
    updatedAt: new Date(),
    ...extra,
  });

  describe(`Store contract: ${name}`, () => {
    it("creates users with grants, replaces the new-user placeholder in events", async () => {
      const s = await make();
      const out = await s.commit({
        companyId: 1,
        request: { requestId: "req-user", actorUserId: 0, procedure: "people.create" },
        users: [{ type: "create", loginName: "ana", displayName: "Ana", pinHash: "h", grants: [{ companyId: 1, roles: ["production", "pack"] }] }],
        events: [{ id: crypto.randomUUID(), companyId: 1, subject: "person", subjectId: NEW_USER_ID, type: "created", actorUserId: 0, requestId: "req-user", payload: {}, createdAt: new Date() }],
        result: (o) => ({ id: o.newUserId }),
      });
      expect(out.newUserId).toBeGreaterThan(0);
      const u = await s.findUserByLoginName("ana");
      expect(u?.grants).toEqual([{ companyId: 1, roles: ["production", "pack"] }]);
      expect(await s.listEvents(1, "person", String(out.newUserId))).toHaveLength(1);
      expect((await s.findRequest(1, "req-user"))?.result).toEqual({ id: out.newUserId });
      await expect(
        s.commit({ companyId: 1, request: null, users: [{ type: "create", loginName: "ana", displayName: "x", pinHash: "h", grants: [] }] }),
      ).rejects.toBeInstanceOf(LoginNameTakenError);

      await s.commit({ companyId: 2, request: null, users: [{ type: "setGrant", userId: out.newUserId!, companyId: 2, roles: ["qm"] }] });
      expect((await s.listUsersForCompany(2)).map((x) => x.id)).toEqual([out.newUserId]);
      await s.commit({ companyId: 1, request: null, users: [{ type: "setGrant", userId: out.newUserId!, companyId: 1, roles: null }] });
      expect(await s.listUsersForCompany(1)).toEqual([]);
    });

    it("sessions", async () => {
      const s = await make();
      const out = await s.commit({ companyId: 1, request: null, users: [{ type: "create", loginName: "bo", displayName: "Bo", pinHash: "h", grants: [{ companyId: 1, roles: [] }] }] });
      await s.createSession({ tokenHash: "a".repeat(64), userId: out.newUserId!, activeCompanyId: 1, expiresAt: new Date(Date.now() + 60_000) });
      await s.updateSessionCompany("a".repeat(64), 2);
      expect((await s.findSession("a".repeat(64)))?.activeCompanyId).toBe(2);
      await s.commit({ companyId: 1, request: null, users: [{ type: "deleteSessions", userId: out.newUserId! }] });
      expect(await s.findSession("a".repeat(64))).toBeNull();
    });

    it("records: company-scoped, version-checked, JSON round-trip, filters", async () => {
      const s = await make();
      await s.commit({ companyId: 1, request: null, creates: [rec("r1", 1, { ownerUserId: 5, parentId: "p" }), rec("r2", 1)] });
      await s.commit({ companyId: 2, request: null, creates: [rec("r3", 2)] });
      expect(await s.getRecord(2, "task", "r1")).toBeNull();
      const r1 = (await s.getRecord(1, "task", "r1"))!;
      expect(r1.data).toEqual({ name: "r1", nested: { ok: true } });
      expect((await s.listRecords(1, "task", { ownerUserId: 5 })).map((r) => r.id)).toEqual(["r1"]);
      expect((await s.listRecords(1, "task", { parentId: "p" })).map((r) => r.id)).toEqual(["r1"]);
      expect((await s.listRecords(1, "task")).map((r) => r.id).sort()).toEqual(["r1", "r2"]);

      await s.commit({ companyId: 1, request: null, updates: [{ record: { ...r1, data: { name: "changed" } }, expectedVersion: 1 }] });
      const after = (await s.getRecord(1, "task", "r1"))!;
      expect(after.version).toBe(2);
      expect(after.data).toEqual({ name: "changed" });
      await expect(s.commit({ companyId: 1, request: null, updates: [{ record: r1, expectedVersion: 1 }] })).rejects.toBeInstanceOf(VersionConflictError);
      // Cross-company update is refused.
      await expect(s.commit({ companyId: 2, request: null, updates: [{ record: after, expectedVersion: 2 }] })).rejects.toBeInstanceOf(VersionConflictError);
    });

    it("idempotency and atomic rollback", async () => {
      const s = await make();
      await s.commit({ companyId: 1, request: null, creates: [rec("x1")] });
      await s.commit({ companyId: 1, request: { requestId: "same", actorUserId: 1, procedure: "p" }, result: () => "first" });
      await expect(s.commit({ companyId: 1, request: { requestId: "same", actorUserId: 1, procedure: "p" } })).rejects.toBeInstanceOf(DuplicateRequestError);
      await s.commit({ companyId: 2, request: { requestId: "same", actorUserId: 1, procedure: "p" } });

      await expect(
        s.commit({
          companyId: 1,
          request: { requestId: "rollback", actorUserId: 1, procedure: "p" },
          creates: [rec("x2")],
          updates: [{ record: rec("x1"), expectedVersion: 99 }],
        }),
      ).rejects.toBeInstanceOf(VersionConflictError);
      expect(await s.getRecord(1, "task", "x2")).toBeNull();
      expect(await s.findRequest(1, "rollback")).toBeNull();
    });
  });
}

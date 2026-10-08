import type { CompanyId } from "@shared/companies";
import {
  DuplicateRequestError,
  LoginNameTakenError,
  NEW_USER_ID,
  VersionConflictError,
  type Commit,
  type CommitOutput,
  type EventSubject,
  type KioskSession,
  type KioskUser,
  type ListFilter,
  type LocalEvent,
  type LocalRecord,
  type RecordKind,
  type Store,
  type StoredRequest,
} from "./types";

const clone = <T>(v: T): T => structuredClone(v);

export class MemoryStore implements Store {
  users = new Map<number, KioskUser>();
  sessions = new Map<string, KioskSession>();
  records = new Map<string, LocalRecord>();
  events: LocalEvent[] = [];
  requests = new Map<string, StoredRequest>();
  private nextUserId = 1;

  /** Test helper: insert a user directly. */
  addUser(user: Omit<KioskUser, "id">): number {
    const id = this.nextUserId++;
    this.users.set(id, { ...clone(user), id });
    return id;
  }

  async findUserByLoginName(loginName: string) {
    for (const u of this.users.values()) if (u.loginName.toLowerCase() === loginName.toLowerCase()) return clone(u);
    return null;
  }
  async findUserById(id: number) {
    const u = this.users.get(id);
    return u ? clone(u) : null;
  }
  async listUsersForCompany(companyId: CompanyId) {
    return [...this.users.values()].filter((u) => u.grants.some((g) => g.companyId === companyId)).map(clone);
  }

  async createSession(session: KioskSession) {
    this.sessions.set(session.tokenHash, clone(session));
  }
  async findSession(tokenHash: string) {
    const s = this.sessions.get(tokenHash);
    return s ? clone(s) : null;
  }
  async updateSessionCompany(tokenHash: string, companyId: CompanyId) {
    const s = this.sessions.get(tokenHash);
    if (s) s.activeCompanyId = companyId;
  }
  async deleteSession(tokenHash: string) {
    this.sessions.delete(tokenHash);
  }

  async getRecord<T>(companyId: CompanyId, kind: RecordKind, id: string) {
    const r = this.records.get(id);
    return r && r.companyId === companyId && r.kind === kind ? (clone(r) as LocalRecord<T>) : null;
  }

  async listRecords<T>(companyId: CompanyId, kind: RecordKind, filter: ListFilter = {}) {
    let list = [...this.records.values()].filter(
      (r) =>
        r.companyId === companyId &&
        r.kind === kind &&
        (filter.ownerUserId === undefined || r.ownerUserId === filter.ownerUserId) &&
        (filter.parentId === undefined || r.parentId === filter.parentId),
    );
    list.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id));
    if (filter.order === "desc") list.reverse();
    if (filter.limit !== undefined) list = list.slice(0, filter.limit);
    return list.map((r) => clone(r) as LocalRecord<T>);
  }

  async listEvents(companyId: CompanyId, subject: EventSubject, subjectId: string) {
    return this.events
      .filter((e) => e.companyId === companyId && e.subject === subject && e.subjectId === subjectId)
      .map(clone);
  }

  async findRequest(companyId: CompanyId, requestId: string) {
    const r = this.requests.get(`${companyId}|${requestId}`);
    return r ? clone(r) : null;
  }

  async commit(c: Commit): Promise<CommitOutput> {
    // Validate everything first so a failed commit changes nothing.
    const reqKey = c.request ? `${c.companyId}|${c.request.requestId}` : null;
    if (reqKey && this.requests.has(reqKey)) throw new DuplicateRequestError();
    for (const r of c.creates ?? []) {
      if (r.companyId !== c.companyId || this.records.has(r.id)) throw new VersionConflictError();
    }
    for (const { record, expectedVersion } of c.updates ?? []) {
      const cur = this.records.get(record.id);
      if (!cur || cur.companyId !== c.companyId || cur.kind !== record.kind || cur.version !== expectedVersion) {
        throw new VersionConflictError();
      }
    }
    for (const w of c.users ?? []) {
      if (w.type === "create" && [...this.users.values()].some((u) => u.loginName.toLowerCase() === w.loginName.toLowerCase())) {
        throw new LoginNameTakenError();
      }
      if (w.type !== "create" && !this.users.has(w.userId)) throw new VersionConflictError();
    }

    const out: CommitOutput = {};
    for (const w of c.users ?? []) {
      if (w.type === "create") {
        out.newUserId = this.addUser({ loginName: w.loginName, displayName: w.displayName, pinHash: w.pinHash, active: true, grants: w.grants });
      } else if (w.type === "update") {
        const u = this.users.get(w.userId)!;
        if (w.displayName !== undefined) u.displayName = w.displayName;
        if (w.pinHash !== undefined) u.pinHash = w.pinHash;
        if (w.active !== undefined) u.active = w.active;
      } else if (w.type === "setGrant") {
        const u = this.users.get(w.userId)!;
        const idx = u.grants.findIndex((g) => g.companyId === w.companyId);
        if (w.roles === null) {
          if (idx >= 0) u.grants.splice(idx, 1);
        } else if (idx >= 0) {
          u.grants[idx]!.roles = [...w.roles];
        } else {
          u.grants.push({ companyId: w.companyId, roles: [...w.roles] });
        }
      } else {
        for (const [k, s] of this.sessions) if (s.userId === w.userId) this.sessions.delete(k);
      }
    }
    for (const r of c.creates ?? []) this.records.set(r.id, clone(r));
    for (const { record, expectedVersion } of c.updates ?? []) {
      this.records.set(record.id, clone({ ...record, version: expectedVersion + 1 }));
    }
    for (const e of c.events ?? []) {
      const subjectId = e.subjectId === NEW_USER_ID && out.newUserId !== undefined ? String(out.newUserId) : e.subjectId;
      this.events.push(clone({ ...e, subjectId }));
    }
    if (reqKey && c.request) {
      this.requests.set(reqKey, {
        actorUserId: c.request.actorUserId,
        procedure: c.request.procedure,
        result: clone(c.result ? c.result(out) : null),
      });
    }
    return out;
  }
}

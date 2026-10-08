import { and, asc, desc, eq, inArray, type SQL } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import { isCompanyId, type CompanyId } from "@shared/companies";
import { isRole } from "@shared/roles";
import {
  kioskSessions,
  kioskUserCompanies,
  kioskUsers,
  localEvents,
  localRecords,
  localRequests,
} from "../../drizzle/schema";
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
  type LocalRecord,
  type RecordKind,
  type Store,
  type StoredRequest,
} from "./types";

type UserRow = typeof kioskUsers.$inferSelect;
type RecordRow = typeof localRecords.$inferSelect;

const isDuplicateKey = (e: unknown): boolean => {
  const err = e as { code?: string; cause?: { code?: string } };
  return err?.code === "ER_DUP_ENTRY" || err?.cause?.code === "ER_DUP_ENTRY";
};

const affectedRows = (res: unknown): number => {
  const header = Array.isArray(res) ? res[0] : res;
  return (header as { affectedRows?: number })?.affectedRows ?? 0;
};

function toRecord<T>(row: RecordRow): LocalRecord<T> | null {
  if (!isCompanyId(row.companyId)) return null;
  return {
    id: row.id,
    companyId: row.companyId,
    kind: row.kind as RecordKind,
    version: row.version,
    ownerUserId: row.ownerUserId,
    parentId: row.parentId,
    data: JSON.parse(row.data) as T,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class MySqlStore implements Store {
  constructor(private readonly db: MySql2Database) {}

  private async withGrants(rows: UserRow[]): Promise<KioskUser[]> {
    if (rows.length === 0) return [];
    const grants = await this.db
      .select()
      .from(kioskUserCompanies)
      .where(inArray(kioskUserCompanies.userId, rows.map((r) => r.id)))
      .orderBy(asc(kioskUserCompanies.sortOrder), asc(kioskUserCompanies.companyId));
    return rows.map((row) => ({
      id: row.id,
      loginName: row.loginName,
      displayName: row.displayName,
      active: row.active,
      pinHash: row.pinHash,
      grants: grants.flatMap((g) => {
        const companyId = g.companyId;
        if (g.userId !== row.id || !isCompanyId(companyId)) return [];
        return [{ companyId, roles: g.roles.split(",").filter(isRole) }];
      }),
    }));
  }

  async findUserByLoginName(loginName: string) {
    const rows = await this.db.select().from(kioskUsers).where(eq(kioskUsers.loginName, loginName)).limit(1);
    return (await this.withGrants(rows))[0] ?? null;
  }

  async findUserById(id: number) {
    const rows = await this.db.select().from(kioskUsers).where(eq(kioskUsers.id, id)).limit(1);
    return (await this.withGrants(rows))[0] ?? null;
  }

  async listUsersForCompany(companyId: CompanyId) {
    const rows = await this.db
      .select({ u: kioskUsers })
      .from(kioskUsers)
      .innerJoin(kioskUserCompanies, eq(kioskUserCompanies.userId, kioskUsers.id))
      .where(eq(kioskUserCompanies.companyId, companyId))
      .orderBy(asc(kioskUsers.displayName));
    return this.withGrants(rows.map((r) => r.u));
  }

  async createSession(session: KioskSession) {
    await this.db.insert(kioskSessions).values(session);
  }

  async findSession(tokenHash: string): Promise<KioskSession | null> {
    const [row] = await this.db.select().from(kioskSessions).where(eq(kioskSessions.tokenHash, tokenHash)).limit(1);
    if (!row || !isCompanyId(row.activeCompanyId)) return null;
    return { ...row, activeCompanyId: row.activeCompanyId };
  }

  async updateSessionCompany(tokenHash: string, companyId: CompanyId) {
    await this.db.update(kioskSessions).set({ activeCompanyId: companyId }).where(eq(kioskSessions.tokenHash, tokenHash));
  }

  async deleteSession(tokenHash: string) {
    await this.db.delete(kioskSessions).where(eq(kioskSessions.tokenHash, tokenHash));
  }

  async getRecord<T>(companyId: CompanyId, kind: RecordKind, id: string) {
    const [row] = await this.db
      .select()
      .from(localRecords)
      .where(and(eq(localRecords.id, id), eq(localRecords.companyId, companyId), eq(localRecords.kind, kind)))
      .limit(1);
    return row ? toRecord<T>(row) : null;
  }

  async listRecords<T>(companyId: CompanyId, kind: RecordKind, filter: ListFilter = {}) {
    const conds: SQL[] = [eq(localRecords.companyId, companyId), eq(localRecords.kind, kind)];
    if (filter.ownerUserId !== undefined) conds.push(eq(localRecords.ownerUserId, filter.ownerUserId));
    if (filter.parentId !== undefined) conds.push(eq(localRecords.parentId, filter.parentId));
    const dir = filter.order === "desc" ? desc : asc;
    const q = this.db
      .select()
      .from(localRecords)
      .where(and(...conds))
      .orderBy(dir(localRecords.createdAt), dir(localRecords.id));
    const rows = filter.limit !== undefined ? await q.limit(filter.limit) : await q;
    return rows.flatMap((r) => {
      const rec = toRecord<T>(r);
      return rec ? [rec] : [];
    });
  }

  async listEvents(companyId: CompanyId, subject: EventSubject, subjectId: string) {
    const rows = await this.db
      .select()
      .from(localEvents)
      .where(and(eq(localEvents.companyId, companyId), eq(localEvents.subject, subject), eq(localEvents.subjectId, subjectId)))
      .orderBy(asc(localEvents.createdAt), asc(localEvents.id));
    return rows.flatMap((r) =>
      isCompanyId(r.companyId)
        ? [{ ...r, companyId: r.companyId, subject: r.subject as EventSubject, payload: JSON.parse(r.payload) as unknown }]
        : [],
    );
  }

  async findRequest(companyId: CompanyId, requestId: string): Promise<StoredRequest | null> {
    const [row] = await this.db
      .select()
      .from(localRequests)
      .where(and(eq(localRequests.companyId, companyId), eq(localRequests.requestId, requestId)))
      .limit(1);
    if (!row) return null;
    return { actorUserId: row.actorUserId, procedure: row.procedure, result: row.result ? JSON.parse(row.result) : null };
  }

  async commit(c: Commit): Promise<CommitOutput> {
    return this.db.transaction(async (tx) => {
      const now = new Date();
      if (c.request) {
        try {
          await tx.insert(localRequests).values({
            companyId: c.companyId,
            requestId: c.request.requestId,
            actorUserId: c.request.actorUserId,
            procedure: c.request.procedure,
            result: null,
            createdAt: now,
          });
        } catch (e) {
          if (isDuplicateKey(e)) throw new DuplicateRequestError();
          throw e;
        }
      }

      const out: CommitOutput = {};
      for (const w of c.users ?? []) {
        if (w.type === "create") {
          let inserted;
          try {
            [inserted] = await tx
              .insert(kioskUsers)
              .values({ loginName: w.loginName, displayName: w.displayName, pinHash: w.pinHash, active: true, createdAt: now })
              .$returningId();
          } catch (e) {
            if (isDuplicateKey(e)) throw new LoginNameTakenError();
            throw e;
          }
          out.newUserId = inserted!.id;
          if (w.grants.length > 0) {
            await tx.insert(kioskUserCompanies).values(
              w.grants.map((g, i) => ({ userId: inserted!.id, companyId: g.companyId, sortOrder: i, roles: g.roles.join(",") })),
            );
          }
        } else if (w.type === "update") {
          const patch: Partial<UserRow> = {};
          if (w.displayName !== undefined) patch.displayName = w.displayName;
          if (w.pinHash !== undefined) patch.pinHash = w.pinHash;
          if (w.active !== undefined) patch.active = w.active;
          const res = await tx.update(kioskUsers).set(patch).where(eq(kioskUsers.id, w.userId));
          if (affectedRows(res) === 0) throw new VersionConflictError();
        } else if (w.type === "setGrant") {
          const where = and(eq(kioskUserCompanies.userId, w.userId), eq(kioskUserCompanies.companyId, w.companyId));
          if (w.roles === null) {
            await tx.delete(kioskUserCompanies).where(where);
          } else {
            const [existing] = await tx.select().from(kioskUserCompanies).where(where).limit(1);
            if (existing) {
              await tx.update(kioskUserCompanies).set({ roles: w.roles.join(",") }).where(where);
            } else {
              await tx.insert(kioskUserCompanies).values({ userId: w.userId, companyId: w.companyId, sortOrder: 99, roles: w.roles.join(",") });
            }
          }
        } else {
          await tx.delete(kioskSessions).where(eq(kioskSessions.userId, w.userId));
        }
      }

      for (const r of c.creates ?? []) {
        if (r.companyId !== c.companyId) throw new VersionConflictError();
        try {
          await tx.insert(localRecords).values({
            id: r.id,
            companyId: r.companyId,
            kind: r.kind,
            version: r.version,
            ownerUserId: r.ownerUserId,
            parentId: r.parentId,
            data: JSON.stringify(r.data),
            createdAt: r.createdAt,
            updatedAt: r.updatedAt,
          });
        } catch (e) {
          if (isDuplicateKey(e)) throw new VersionConflictError();
          throw e;
        }
      }

      for (const { record: r, expectedVersion } of c.updates ?? []) {
        const res = await tx
          .update(localRecords)
          .set({
            version: expectedVersion + 1,
            ownerUserId: r.ownerUserId,
            parentId: r.parentId,
            data: JSON.stringify(r.data),
            updatedAt: r.updatedAt,
          })
          .where(
            and(
              eq(localRecords.id, r.id),
              eq(localRecords.companyId, c.companyId),
              eq(localRecords.kind, r.kind),
              eq(localRecords.version, expectedVersion),
            ),
          );
        if (affectedRows(res) === 0) throw new VersionConflictError();
      }

      const events = c.events ?? [];
      if (events.length > 0) {
        await tx.insert(localEvents).values(
          events.map((e) => ({
            ...e,
            subjectId: e.subjectId === NEW_USER_ID && out.newUserId !== undefined ? String(out.newUserId) : e.subjectId,
            payload: JSON.stringify(e.payload ?? null),
          })),
        );
      }

      if (c.request) {
        await tx
          .update(localRequests)
          .set({ result: JSON.stringify(c.result ? c.result(out) : null) })
          .where(and(eq(localRequests.companyId, c.companyId), eq(localRequests.requestId, c.request.requestId)));
      }
      return out;
    });
  }
}

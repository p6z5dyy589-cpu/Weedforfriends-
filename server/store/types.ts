import type { CompanyId } from "@shared/companies";
import type { Role } from "@shared/roles";

export interface CompanyGrant {
  companyId: CompanyId;
  roles: Role[];
}

export interface KioskUser {
  id: number;
  loginName: string;
  displayName: string;
  active: boolean;
  pinHash: string;
  /** Ordered: the first grant is the default company after login. */
  grants: CompanyGrant[];
}

export interface KioskSession {
  tokenHash: string;
  userId: number;
  activeCompanyId: CompanyId;
  expiresAt: Date;
}

/** Kinds of local, Odoo-independent records ("local_unbooked"). */
export const RECORD_KINDS = [
  "task",
  "roleMatrix",
  "attendance",
  "notification",
  "conversation",
  "chatMessage",
  "chatRead",
  "location",
  "file",
] as const;
export type RecordKind = (typeof RECORD_KINDS)[number];

/** Event subjects: every record kind plus people (kiosk users). */
export type EventSubject = RecordKind | "person";

export interface LocalRecord<T = unknown> {
  id: string;
  companyId: CompanyId;
  kind: RecordKind;
  version: number;
  ownerUserId: number | null;
  parentId: string | null;
  data: T;
  createdAt: Date;
  updatedAt: Date;
}

/** Append-only audit event. Never updated or deleted. */
export interface LocalEvent {
  id: string;
  companyId: CompanyId;
  subject: EventSubject;
  subjectId: string;
  type: string;
  actorUserId: number;
  requestId: string | null;
  payload: unknown;
  createdAt: Date;
}

export interface ListFilter {
  ownerUserId?: number;
  parentId?: string;
  order?: "asc" | "desc";
  limit?: number;
}

/** Placeholder for the id of a user created in the same commit. */
export const NEW_USER_ID = "$newUser";

export type UserWrite =
  | { type: "create"; loginName: string; displayName: string; pinHash: string; grants: CompanyGrant[] }
  | { type: "update"; userId: number; displayName?: string; pinHash?: string; active?: boolean }
  | { type: "setGrant"; userId: number; companyId: CompanyId; roles: Role[] | null }
  | { type: "deleteSessions"; userId: number };

export interface CommitRequest {
  requestId: string;
  actorUserId: number;
  procedure: string;
}

export interface Commit {
  companyId: CompanyId;
  request: CommitRequest | null;
  creates?: LocalRecord[];
  updates?: { record: LocalRecord; expectedVersion: number }[];
  events?: LocalEvent[];
  users?: UserWrite[];
  /** Builds the stored idempotent result once ids are known. */
  result?: (out: CommitOutput) => unknown;
}

export interface CommitOutput {
  newUserId?: number;
}

export interface StoredRequest {
  actorUserId: number;
  procedure: string;
  result: unknown;
}

export class DuplicateRequestError extends Error {}
export class VersionConflictError extends Error {}
export class LoginNameTakenError extends Error {}

/**
 * Single persistence boundary. MySQL in production, memory in the isolated
 * standard test suite. Every local write goes through commit(), which is
 * atomic, version-checked and idempotent per (company, requestId).
 */
export interface Store {
  findUserByLoginName(loginName: string): Promise<KioskUser | null>;
  findUserById(id: number): Promise<KioskUser | null>;
  listUsersForCompany(companyId: CompanyId): Promise<KioskUser[]>;

  createSession(session: KioskSession): Promise<void>;
  findSession(tokenHash: string): Promise<KioskSession | null>;
  updateSessionCompany(tokenHash: string, companyId: CompanyId): Promise<void>;
  deleteSession(tokenHash: string): Promise<void>;

  getRecord<T>(companyId: CompanyId, kind: RecordKind, id: string): Promise<LocalRecord<T> | null>;
  listRecords<T>(companyId: CompanyId, kind: RecordKind, filter?: ListFilter): Promise<LocalRecord<T>[]>;
  listEvents(companyId: CompanyId, subject: EventSubject, subjectId: string): Promise<LocalEvent[]>;
  findRequest(companyId: CompanyId, requestId: string): Promise<StoredRequest | null>;
  commit(commit: Commit): Promise<CommitOutput>;
}

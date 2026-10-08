import {
  mysqlTable,
  int,
  varchar,
  boolean,
  datetime,
  mysqlEnum,
  char,
  longtext,
  primaryKey,
  index,
  uniqueIndex,
} from "drizzle-orm/mysql-core";

export const kioskUsers = mysqlTable(
  "kiosk_users",
  {
    id: int("id").autoincrement().primaryKey(),
    loginName: varchar("login_name", { length: 64 }).notNull(),
    displayName: varchar("display_name", { length: 128 }).notNull(),
    /**
     * Deprecated since migration 0001 - roles live per company in
     * kiosk_user_companies.roles. Kept because removing a column is a
     * destructive migration that needs its own approval.
     */
    role: mysqlEnum("role", ["employee", "coordinator"]).notNull().default("employee"),
    active: boolean("active").notNull().default(true),
    pinHash: varchar("pin_hash", { length: 255 }).notNull(),
    createdAt: datetime("created_at").notNull(),
  },
  (t) => [uniqueIndex("kiosk_users_login_name_uq").on(t.loginName)],
);

/** Server-side company grants. Company 1 = Solovya, 2 = Xenon. */
export const kioskUserCompanies = mysqlTable(
  "kiosk_user_companies",
  {
    userId: int("user_id").notNull(),
    companyId: int("company_id").notNull(),
    sortOrder: int("sort_order").notNull().default(0),
    /** Comma-separated roles for this company. */
    roles: varchar("roles", { length: 255 }).notNull().default(""),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.companyId] }),
    index("kiosk_user_companies_company_idx").on(t.companyId),
  ],
);

export const kioskSessions = mysqlTable(
  "kiosk_sessions",
  {
    tokenHash: char("token_hash", { length: 64 }).primaryKey(),
    userId: int("user_id").notNull(),
    activeCompanyId: int("active_company_id").notNull(),
    expiresAt: datetime("expires_at").notNull(),
  },
  (t) => [index("kiosk_sessions_user_idx").on(t.userId)],
);

/** Local, Odoo-independent records (source: local_unbooked). JSON in data. */
export const localRecords = mysqlTable(
  "local_records",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    companyId: int("company_id").notNull(),
    kind: varchar("kind", { length: 32 }).notNull(),
    version: int("version").notNull(),
    ownerUserId: int("owner_user_id"),
    parentId: varchar("parent_id", { length: 64 }),
    data: longtext("data").notNull(),
    createdAt: datetime("created_at", { fsp: 3 }).notNull(),
    updatedAt: datetime("updated_at", { fsp: 3 }).notNull(),
  },
  (t) => [
    index("local_records_company_kind_owner_idx").on(t.companyId, t.kind, t.ownerUserId),
    index("local_records_company_kind_parent_idx").on(t.companyId, t.kind, t.parentId),
  ],
);

/** Append-only audit trail. Rows are never updated or deleted. */
export const localEvents = mysqlTable(
  "local_events",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    companyId: int("company_id").notNull(),
    subject: varchar("subject", { length: 32 }).notNull(),
    subjectId: varchar("subject_id", { length: 64 }).notNull(),
    type: varchar("type", { length: 64 }).notNull(),
    actorUserId: int("actor_user_id").notNull(),
    requestId: varchar("request_id", { length: 64 }),
    payload: longtext("payload").notNull(),
    createdAt: datetime("created_at", { fsp: 3 }).notNull(),
  },
  (t) => [index("local_events_subject_idx").on(t.companyId, t.subject, t.subjectId)],
);

/** Idempotency: one row per (company, requestId) with the stored result. */
export const localRequests = mysqlTable(
  "local_requests",
  {
    companyId: int("company_id").notNull(),
    requestId: varchar("request_id", { length: 64 }).notNull(),
    actorUserId: int("actor_user_id").notNull(),
    procedure: varchar("procedure", { length: 64 }).notNull(),
    result: longtext("result"),
    createdAt: datetime("created_at", { fsp: 3 }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.companyId, t.requestId] })],
);

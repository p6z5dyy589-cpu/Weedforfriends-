import {
  mysqlTable,
  int,
  varchar,
  boolean,
  datetime,
  mysqlEnum,
  char,
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

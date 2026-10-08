import { asc, eq } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import { isCompanyId, type CompanyId } from "@shared/companies";
import { kioskSessions, kioskUserCompanies, kioskUsers } from "../../drizzle/schema";
import type { AuthStore, KioskSession, KioskUser } from "./store";

export class MySqlAuthStore implements AuthStore {
  constructor(private readonly db: MySql2Database) {}

  private async withCompanies(row: typeof kioskUsers.$inferSelect | undefined): Promise<KioskUser | null> {
    if (!row) return null;
    const grants = await this.db
      .select({ companyId: kioskUserCompanies.companyId })
      .from(kioskUserCompanies)
      .where(eq(kioskUserCompanies.userId, row.id))
      .orderBy(asc(kioskUserCompanies.sortOrder));
    return {
      id: row.id,
      loginName: row.loginName,
      displayName: row.displayName,
      role: row.role,
      active: row.active,
      pinHash: row.pinHash,
      companyIds: grants.map((g) => g.companyId).filter(isCompanyId),
    };
  }

  async findUserByLoginName(loginName: string) {
    const [row] = await this.db.select().from(kioskUsers).where(eq(kioskUsers.loginName, loginName)).limit(1);
    return this.withCompanies(row);
  }

  async findUserById(id: number) {
    const [row] = await this.db.select().from(kioskUsers).where(eq(kioskUsers.id, id)).limit(1);
    return this.withCompanies(row);
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
}

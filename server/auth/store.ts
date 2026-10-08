import type { CompanyId } from "@shared/companies";
import type { Role } from "@shared/roles";

export interface KioskUser {
  id: number;
  loginName: string;
  displayName: string;
  role: Role;
  active: boolean;
  pinHash: string;
  companyIds: CompanyId[];
}

export interface KioskSession {
  tokenHash: string;
  userId: number;
  activeCompanyId: CompanyId;
  expiresAt: Date;
}

/** Persistence boundary for kiosk auth. MySQL in production, memory in tests. */
export interface AuthStore {
  findUserByLoginName(loginName: string): Promise<KioskUser | null>;
  findUserById(id: number): Promise<KioskUser | null>;
  createSession(session: KioskSession): Promise<void>;
  findSession(tokenHash: string): Promise<KioskSession | null>;
  updateSessionCompany(tokenHash: string, companyId: CompanyId): Promise<void>;
  deleteSession(tokenHash: string): Promise<void>;
}

export class MemoryAuthStore implements AuthStore {
  users = new Map<number, KioskUser>();
  sessions = new Map<string, KioskSession>();

  async findUserByLoginName(loginName: string) {
    for (const u of this.users.values()) if (u.loginName === loginName) return u;
    return null;
  }
  async findUserById(id: number) {
    return this.users.get(id) ?? null;
  }
  async createSession(session: KioskSession) {
    this.sessions.set(session.tokenHash, { ...session });
  }
  async findSession(tokenHash: string) {
    const s = this.sessions.get(tokenHash);
    return s ? { ...s } : null;
  }
  async updateSessionCompany(tokenHash: string, companyId: CompanyId) {
    const s = this.sessions.get(tokenHash);
    if (s) s.activeCompanyId = companyId;
  }
  async deleteSession(tokenHash: string) {
    this.sessions.delete(tokenHash);
  }
}

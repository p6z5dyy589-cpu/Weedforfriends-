import type { CompanyId } from "@shared/companies";
import type { Role } from "@shared/roles";
import type { Store, KioskUser } from "../store/types";

export function rolesIn(user: KioskUser, companyId: CompanyId): Role[] {
  return user.grants.find((g) => g.companyId === companyId)?.roles ?? [];
}

/** Active people of one company; everyone else is invisible to this company. */
export async function companyPeople(store: Store, companyId: CompanyId): Promise<KioskUser[]> {
  return (await store.listUsersForCompany(companyId)).filter((u) => u.active);
}

export async function personInCompany(store: Store, companyId: CompanyId, userId: number): Promise<KioskUser | null> {
  const user = await store.findUserById(userId);
  if (!user || !user.active || !user.grants.some((g) => g.companyId === companyId)) return null;
  return user;
}

export async function usersWithRole(store: Store, companyId: CompanyId, roles: readonly Role[]): Promise<number[]> {
  return (await companyPeople(store, companyId)).filter((u) => rolesIn(u, companyId).some((r) => roles.includes(r))).map((u) => u.id);
}

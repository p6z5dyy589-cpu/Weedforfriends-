export const COMPANIES = [
  { id: 1, key: "solovya", name: "Solovya" },
  { id: 2, key: "xenon", name: "Xenon" },
] as const;

export type CompanyId = (typeof COMPANIES)[number]["id"];

export function isCompanyId(value: unknown): value is CompanyId {
  return COMPANIES.some((c) => c.id === value);
}

export function companyName(id: CompanyId): string {
  return COMPANIES.find((c) => c.id === id)!.name;
}

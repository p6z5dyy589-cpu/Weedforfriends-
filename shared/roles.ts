/**
 * Roles are granted per person AND per company. A person can hold several.
 * Matches the role model of the process handbook (chapter 3.1).
 */
export const ROLES = [
  "production", // Produktionsmitarbeiter
  "reviewer", // Vincent / Prüfer
  "planner", // Planer
  "qm", // Qualität
  "pack", // Pack-Owner
  "shipping", // Versand-Owner
  "incoming", // Wareneingang-Owner
  "coordinator", // Koordinator
] as const;

export type Role = (typeof ROLES)[number];

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export function hasAnyRole(roles: readonly Role[], wanted: readonly Role[]): boolean {
  return wanted.some((r) => roles.includes(r));
}

/** Roles that may see and steer the coordination layer. */
export const COORDINATION_ROLES: readonly Role[] = ["coordinator", "reviewer", "planner"];

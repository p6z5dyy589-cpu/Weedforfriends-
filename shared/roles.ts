export const ROLES = ["employee", "coordinator"] as const;
export type Role = (typeof ROLES)[number];

export function isCoordinator(role: Role): boolean {
  return role === "coordinator";
}

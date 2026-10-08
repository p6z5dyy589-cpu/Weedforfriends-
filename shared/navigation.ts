import type { Role } from "./roles";

/** Fixed order of the work groups in the mobile menu. */
export const NAV_GROUPS = [
  "today",
  "production",
  "orderDelivery",
  "planningWarehouse",
  "coordination",
  "communication",
] as const;

export type NavGroup = (typeof NAV_GROUPS)[number];

export interface NavItem {
  group: NavGroup;
  path: string;
  /** Translation key for the label. */
  labelKey: string;
  roles: readonly Role[];
}

/**
 * Only routes that actually exist are listed here. Groups without items are
 * shown as "not set up yet" instead of pretending a function is available.
 */
export const NAV_ITEMS: readonly NavItem[] = [
  { group: "today", path: "/", labelKey: "nav.item.home", roles: ["employee", "coordinator"] },
];

export function navItemsFor(role: Role): NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}

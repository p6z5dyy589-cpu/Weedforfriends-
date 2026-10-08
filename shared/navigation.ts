import type { Role } from "./roles";

/** Fixed order of the work groups in the mobile menu (handbook 4.2). */
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
  /** "all" = every signed-in person of the company. */
  roles: readonly Role[] | "all";
  /** Coordination pages are marked as such and never dominate the start page. */
  coordination?: boolean;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { group: "today", path: "/", labelKey: "nav.item.home", roles: "all" },
  { group: "today", path: "/arbeitsplatz", labelKey: "nav.item.workplace", roles: "all" },

  { group: "production", path: "/pruefung", labelKey: "nav.item.review", roles: ["reviewer", "qm"] },

  { group: "orderDelivery", path: "/packen", labelKey: "nav.item.packing", roles: ["pack", "shipping", "coordinator"] },

  { group: "planningWarehouse", path: "/planung", labelKey: "nav.item.planning", roles: ["planner", "coordinator"], coordination: true },
  { group: "planningWarehouse", path: "/aufgabe-neu", labelKey: "nav.item.newTask", roles: ["planner", "coordinator", "reviewer", "incoming"], coordination: true },
  { group: "planningWarehouse", path: "/wareneingang", labelKey: "nav.item.incoming", roles: ["incoming", "coordinator"] },
  { group: "planningWarehouse", path: "/lagerkarte", labelKey: "nav.item.warehouseMap", roles: "all" },

  { group: "coordination", path: "/leitstand", labelKey: "nav.item.control", roles: ["coordinator", "reviewer", "planner"], coordination: true },
  { group: "coordination", path: "/team", labelKey: "nav.item.team", roles: ["coordinator"], coordination: true },
  { group: "coordination", path: "/zustaendigkeiten", labelKey: "nav.item.matrix", roles: ["coordinator"], coordination: true },
  { group: "coordination", path: "/personen", labelKey: "nav.item.people", roles: ["coordinator"], coordination: true },

  { group: "communication", path: "/nachrichten", labelKey: "nav.item.notifications", roles: "all" },
  { group: "communication", path: "/chat", labelKey: "nav.item.chat", roles: "all" },
];

export function canSee(item: Pick<NavItem, "roles">, roles: readonly Role[]): boolean {
  return item.roles === "all" || item.roles.some((r) => roles.includes(r));
}

export function navItemsFor(roles: readonly Role[]): NavItem[] {
  return NAV_ITEMS.filter((item) => canSee(item, roles));
}

export function canAccessPath(path: string, roles: readonly Role[]): boolean {
  const item = NAV_ITEMS.find((i) => i.path === path);
  return item ? canSee(item, roles) : true;
}

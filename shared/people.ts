import type { Role } from "./roles";

export interface PersonSummary {
  id: number;
  displayName: string;
  roles: Role[];
}

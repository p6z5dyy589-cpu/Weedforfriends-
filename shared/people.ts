import type { Role } from "./roles";

export interface PersonSummary {
  id: number;
  displayName: string;
  /** Short name, used for @mentions in chat. */
  loginName: string;
  roles: Role[];
}

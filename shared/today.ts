import type { BlockReason, ProcessType, TaskStatus, Unit } from "./tasks";

/** What the one big button on a card does (handbook 20.1). */
export type CardAction =
  | "openTask" // Fertigung öffnen / Aufgabe öffnen
  | "continue" // Fortsetzen
  | "viewDetails" // Details ansehen (waiting)
  | "acceptHandover" // Ware am Packplatz annehmen
  | "openPacklist" // Packliste öffnen
  | "checkIncoming" // Wareneingang prüfen
  | "openClarification"; // Klärung öffnen

export interface TodayCard {
  id: string;
  companyId: number;
  processType: ProcessType;
  reference: string;
  product: string;
  quantity: number | null;
  unit: Unit;
  responsible: string | null;
  status: TaskStatus;
  action: CardAction;
  blockReason?: BlockReason;
  /** Waiting for a previous local step (e.g. bulk before packaging). */
  waitingFor?: "dependency";
}

export interface TodayOverview {
  companyId: number;
  now: TodayCard | null;
  next: TodayCard[];
  waiting: TodayCard[];
  /** Only filled after a real Odoo readback - never from local state. */
  labelsReady: TodayCard[];
  clarify: TodayCard[];
}

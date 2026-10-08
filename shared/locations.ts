/** Hierarchy of the local warehouse map (handbook 11.1). Orientation only. */
export const LOCATION_LEVELS = ["site", "zone", "aisle", "rack", "shelf", "bin"] as const;
export type LocationLevel = (typeof LOCATION_LEVELS)[number];

export interface LocationData {
  level: LocationLevel;
  parentId: string | null;
  code: string;
  name: string;
  /** 2D position on the parent's grid (0..99), size 1..100. */
  x: number;
  y: number;
  w: number;
  h: number;
  active: boolean;
  layoutVersion: number;
}

export const LOCATION_CODE = /^[A-Z0-9][A-Z0-9._-]{0,31}$/;
const QR_PREFIX = "FE-LOC";

export function qrPayload(companyId: number, code: string, layoutVersion: number): string {
  return `${QR_PREFIX}:${companyId}:${code}:${layoutVersion}`;
}

export type ParsedScan = { kind: "qr"; companyId: number; code: string; layoutVersion: number } | { kind: "text"; code: string } | null;

export function parseScan(raw: string): ParsedScan {
  const s = raw.trim();
  const m = /^FE-LOC:(\d+):([A-Z0-9][A-Z0-9._-]{0,31}):(\d+)$/.exec(s);
  if (m) return { kind: "qr", companyId: Number(m[1]), code: m[2]!, layoutVersion: Number(m[3]) };
  const code = s.toUpperCase();
  return LOCATION_CODE.test(code) ? { kind: "text", code } : null;
}

export function validParent(child: LocationLevel, parent: LocationLevel | null): boolean {
  const i = LOCATION_LEVELS.indexOf(child);
  if (i === 0) return parent === null;
  return parent === LOCATION_LEVELS[i - 1];
}

/** "vor 5 Minuten" / "před 5 minutami" – short relative time in the UI language. */
export function relativeTime(at: Date | string, language: string, now: Date = new Date()): string {
  const d = typeof at === "string" ? new Date(at) : at;
  const diffSec = Math.round((d.getTime() - now.getTime()) / 1000);
  const abs = Math.abs(diffSec);
  const rtf = new Intl.RelativeTimeFormat(language, { numeric: "auto" });
  if (abs < 60) return rtf.format(0, "second");
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), "hour");
  if (abs < 7 * 86400) return rtf.format(Math.round(diffSec / 86400), "day");
  return d.toLocaleDateString(language, { day: "numeric", month: "numeric", year: "2-digit" });
}

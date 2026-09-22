import { formatMonth } from "./view";

/** The league season: September 2026 through September 2027 inclusive. */
export const SEASON_START = "2026-09";
export const SEASON_END = "2027-09";

export function seasonMonths(): string[] {
  const months: string[] = [];
  const [y, m] = SEASON_START.split("-").map(Number);
  const [endY, endM] = SEASON_END.split("-").map(Number);
  let cur = new Date(y, m - 1, 1);
  const end = new Date(endY, endM - 1, 1);
  while (cur <= end) {
    months.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}`);
    cur.setMonth(cur.getMonth() + 1);
  }
  return months;
}

export function seasonMonthOptions(): { value: string; label: string }[] {
  return seasonMonths().map((mo) => ({ value: mo, label: formatMonth(mo) }));
}

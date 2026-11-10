/**
 * Calendar-date helpers. Plans work on local calendar days ("YYYY-MM-DD"),
 * never on timestamps, so DST shifts can't move a workout to another day.
 */
export type IsoDate = string;

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function toIsoDate(d: Date): IsoDate {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseIsoDate(iso: IsoDate): Date {
  const match = ISO_RE.exec(iso);
  if (!match) throw new Error(`Invalid ISO date: ${iso}`);
  const [, y, m, d] = match;
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  if (toIsoDate(date) !== iso) throw new Error(`Invalid ISO date: ${iso}`);
  return date;
}

export function addDays(iso: IsoDate, days: number): IsoDate {
  const d = parseIsoDate(iso);
  d.setDate(d.getDate() + days);
  return toIsoDate(d);
}

/** `count` consecutive dates starting at `start` (inclusive). */
export function dateRange(start: IsoDate, count: number): IsoDate[] {
  return Array.from({ length: count }, (_, i) => addDays(start, i));
}

/** Whole calendar days from `a` to `b` (positive if b is later). */
export function daysBetween(a: IsoDate, b: IsoDate): number {
  const ms = Date.UTC(...utcParts(b)) - Date.UTC(...utcParts(a));
  return Math.round(ms / 86_400_000);
}

function utcParts(iso: IsoDate): [number, number, number] {
  const d = parseIsoDate(iso);
  return [d.getFullYear(), d.getMonth(), d.getDate()];
}

export function weekdayShort(iso: IsoDate): string {
  return parseIsoDate(iso).toLocaleDateString('en-GB', { weekday: 'short' });
}

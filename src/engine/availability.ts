import { dateRange, weekdayIndex, type IsoDate } from '../lib/dates';
import type { AvailabilityOverride, AvailabilityTemplate, DayAvailability } from './types';

/** A date range during which no training is possible (e.g. HOLIDAY events). */
export interface BlockedRange {
  start: IsoDate;
  /** Inclusive. */
  end: IsoDate;
  reason: string;
}

export interface ResolvedDay extends DayAvailability {
  date: IsoDate;
  source: 'template' | 'override' | 'blocked';
  note?: string;
}

/**
 * Effective availability for a day. Priority: explicit override →
 * blocked range (holiday) → weekly template.
 */
export function resolveDay(
  date: IsoDate,
  template: AvailabilityTemplate,
  overrides: ReadonlyMap<IsoDate, AvailabilityOverride>,
  blocked: readonly BlockedRange[] = [],
): ResolvedDay {
  const o = overrides.get(date);
  if (o) return { date, minutes: o.minutes, mode: o.mode, source: 'override', note: o.note };
  const b = blocked.find((r) => date >= r.start && date <= r.end);
  if (b) return { date, minutes: 0, mode: 'any', source: 'blocked', note: b.reason };
  const t = template[weekdayIndex(date)] ?? { minutes: 0, mode: 'any' as const };
  return { date, minutes: t.minutes, mode: t.mode, source: 'template' };
}

export function resolveRange(
  start: IsoDate,
  days: number,
  template: AvailabilityTemplate,
  overrides: readonly AvailabilityOverride[],
  blocked: readonly BlockedRange[] = [],
): ResolvedDay[] {
  const byDate = new Map(overrides.map((o) => [o.date, o]));
  return dateRange(start, days).map((d) => resolveDay(d, template, byDate, blocked));
}

/** Available minutes per week for `weeks` weeks starting on Monday `firstMonday`. */
export function weeklyMinutes(
  firstMonday: IsoDate,
  weeks: number,
  template: AvailabilityTemplate,
  overrides: readonly AvailabilityOverride[],
  blocked: readonly BlockedRange[] = [],
): number[] {
  const days = resolveRange(firstMonday, weeks * 7, template, overrides, blocked);
  return Array.from({ length: weeks }, (_, w) =>
    days.slice(w * 7, w * 7 + 7).reduce((s, d) => s + d.minutes, 0),
  );
}

export function templateMinutes(template: AvailabilityTemplate): number {
  return template.reduce((s, d) => s + d.minutes, 0);
}

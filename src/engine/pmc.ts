import { addDays, dateRange, daysBetween, type IsoDate } from '../lib/dates';

/** Banister / PMC time constants (days). */
export const CTL_DAYS = 42;
export const ATL_DAYS = 7;

export interface PmcPoint {
  date: IsoDate;
  load: number;
  ctl: number;
  atl: number;
  /** Form: CTL − ATL. */
  tsb: number;
  /** 'intervals' = taken from intervals.icu wellness; 'computed' = derived here. */
  source: 'intervals' | 'computed';
}

export interface LoadSource {
  date: IsoDate;
  icu_training_load?: number | null;
}

export interface FitnessSource {
  id: IsoDate;
  ctl?: number | null;
  atl?: number | null;
}

/** Sums training load per day across all sports (other sports count, PLAN §3.1). */
export function dailyLoads(activities: readonly LoadSource[]): Map<IsoDate, number> {
  const loads = new Map<IsoDate, number>();
  for (const a of activities) {
    const load = a.icu_training_load ?? 0;
    if (load > 0) loads.set(a.date, (loads.get(a.date) ?? 0) + load);
  }
  return loads;
}

/** One PMC step: yesterday's CTL/ATL plus today's load. */
export function stepPmc(prev: { ctl: number; atl: number }, load: number): { ctl: number; atl: number } {
  return {
    ctl: prev.ctl + (load - prev.ctl) / CTL_DAYS,
    atl: prev.atl + (load - prev.atl) / ATL_DAYS,
  };
}

/**
 * Daily PMC series from `from` to `to` (inclusive).
 * intervals.icu's own CTL/ATL are used where present; gaps are filled by
 * stepping forward from the previous day with the day's load.
 */
export function buildPmcSeries(
  wellness: readonly FitnessSource[],
  loads: ReadonlyMap<IsoDate, number>,
  from: IsoDate,
  to: IsoDate,
  start: { ctl: number; atl: number } = { ctl: 0, atl: 0 },
): PmcPoint[] {
  const byDate = new Map(wellness.map((w) => [w.id, w]));
  const days = daysBetween(from, to) + 1;
  if (days <= 0) return [];

  // Seed from the day before `from` if intervals.icu knows it.
  const seed = byDate.get(addDays(from, -1));
  let prev = seed?.ctl != null && seed.atl != null ? { ctl: seed.ctl, atl: seed.atl } : start;

  return dateRange(from, days).map((date) => {
    const load = loads.get(date) ?? 0;
    const w = byDate.get(date);
    const known = w?.ctl != null && w.atl != null;
    const next = known ? { ctl: w.ctl as number, atl: w.atl as number } : stepPmc(prev, load);
    prev = next;
    return { date, load, ctl: next.ctl, atl: next.atl, tsb: next.ctl - next.atl, source: known ? 'intervals' : 'computed' };
  });
}

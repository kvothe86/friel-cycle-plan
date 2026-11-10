import { addDays, daysBetween, type IsoDate } from '../lib/dates';

/**
 * Sickness mode (PLAN §2.5): rest while sick, then a staged return —
 * re-entry (endurance only, short) → reload (one tempo/sweet spot) → plan.
 */

export type Severity = 'mild' | 'severe';

export interface SicknessEpisode {
  id: string;
  start: IsoDate;
  /** Last sick day (inclusive). Undefined while still sick. */
  end?: IsoDate;
  severity: Severity;
  source: 'local' | 'intervals';
  /** 'injury' follows the same flow without the illness-specific rules. */
  kind?: 'illness' | 'injury';
}

/** Without an end date, assume at least this many sick days. */
export const MIN_OPEN_SICK_DAYS = 3;
/** Severe illness: symptom-free days before the return starts. */
export const SEVERE_SYMPTOM_FREE_DAYS = 2;
/** Re-entry rides use this share of the available time, capped. */
export const REENTRY_DURATION_SHARE = 0.7;
export const REENTRY_MAX_MINUTES = 75;
/** Level penalty per sick day, ×1.5 for severe; capped; fades after 4 weeks. */
export const LEVEL_PENALTY_PER_DAY = 0.5;
export const MAX_LEVEL_PENALTY = 3;
export const PENALTY_FADE_DAYS = 28;

export type HealthStage = 'sick' | 'symptom-free' | 'reentry' | 'reload';

export interface HealthStatus {
  stage: HealthStage;
  episode: SicknessEpisode;
  /** 1-based day within the stage. */
  day: number;
  length: number;
}

/** Last sick day: the end date, or (still sick) at least MIN_OPEN_SICK_DAYS and never before today. */
export function effectiveEnd(ep: SicknessEpisode, today: IsoDate): IsoDate {
  if (ep.end) return ep.end;
  const minEnd = addDays(ep.start, MIN_OPEN_SICK_DAYS - 1);
  return minEnd > today ? minEnd : today;
}

export function sickDays(ep: SicknessEpisode, today: IsoDate): number {
  return daysBetween(ep.start, effectiveEnd(ep, today)) + 1;
}

export function stageLengths(ep: SicknessEpisode, today: IsoDate) {
  const n = sickDays(ep, today);
  const severe = ep.severity === 'severe' && ep.kind !== 'injury';
  const reentry = severe ? Math.min(Math.max(n, 3), 7) : 2;
  return { symptomFree: severe ? SEVERE_SYMPTOM_FREE_DAYS : 0, reentry, reload: reentry };
}

/** Health stage for a date, from the most recent episode that started on or before it. */
export function healthStatus(date: IsoDate, episodes: readonly SicknessEpisode[], today: IsoDate): HealthStatus | null {
  const ep = [...episodes].filter((e) => e.start <= date).sort((a, b) => (a.start < b.start ? 1 : -1))[0];
  if (!ep) return null;
  const end = effectiveEnd(ep, today);
  if (date <= end) return { stage: 'sick', episode: ep, day: daysBetween(ep.start, date) + 1, length: sickDays(ep, today) };
  const len = stageLengths(ep, today);
  let offset = daysBetween(end, date); // 1 = first day after being sick
  for (const [stage, length] of [['symptom-free', len.symptomFree], ['reentry', len.reentry], ['reload', len.reload]] as const) {
    if (offset <= length) return { stage, episode: ep, day: offset, length };
    offset -= length;
  }
  return null;
}

/** Progression-level penalty from recent illness. */
export function levelPenalty(episodes: readonly SicknessEpisode[], today: IsoDate): number {
  let total = 0;
  for (const ep of episodes) {
    const end = effectiveEnd(ep, today);
    if (daysBetween(end, today) > PENALTY_FADE_DAYS) continue;
    const factor = ep.severity === 'severe' && ep.kind !== 'injury' ? 1.5 : 1;
    total += sickDays(ep, today) * LEVEL_PENALTY_PER_DAY * factor;
  }
  return Math.min(MAX_LEVEL_PENALTY, total);
}

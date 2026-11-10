import { daysBetween, type IsoDate } from '../lib/dates';
import { compliance } from './compliance';
import type { SessionType } from './focus';
import { levelPenalty, type SicknessEpisode } from './sickness';
import type { Experience } from './types';

/**
 * Progression levels per energy system (PLAN §3.1), replayed from history:
 * every planned session that was ridden moves the level of its system.
 */

export type EnergySystem = 'endurance' | 'tempo' | 'sweetspot' | 'threshold' | 'vo2' | 'anaerobic';
export const ENERGY_SYSTEMS: EnergySystem[] = ['endurance', 'tempo', 'sweetspot', 'threshold', 'vo2', 'anaerobic'];

export const SYSTEM_OF: Record<SessionType, EnergySystem | null> = {
  recovery: null,
  endurance: 'endurance',
  long: 'endurance',
  tempo: 'tempo',
  sweetspot: 'sweetspot',
  threshold: 'threshold',
  overunder: 'threshold',
  race_sim: 'threshold',
  vo2: 'vo2',
  anaerobic: 'anaerobic',
  sprint: 'anaerobic',
  openers: null,
  ftp_test: null,
};

export const START_LEVEL: Record<Experience, number> = { novice: 3, intermediate: 4, advanced: 6 };
export const LEVEL_UP = 0.3;
export const LEVEL_UP_EASY = 0.1;
export const LEVEL_UP_OVER = 0.4;
export const LEVEL_DOWN_PARTIAL = 0.3;
export const LEVEL_DOWN_MISSED = 0.5;
/** No session of a system for this long → levels start to slide. */
export const DECAY_AFTER_DAYS = 21;
export const DECAY_PER_WEEK = 0.25;

/** The committed plan for a day, logged so progression works without pushing to intervals.icu. */
export interface PlanLogEntry {
  date: IsoDate;
  type: SessionType;
  level: number;
  tss: number;
  seconds: number;
  key: boolean;
}

export interface RideLite {
  date: IsoDate;
  load: number;
  seconds: number;
}

export type Levels = Record<EnergySystem, number>;

const clamp = (v: number) => Math.min(10, Math.max(1, v));

export function computeLevels(
  experience: Experience,
  log: readonly PlanLogEntry[],
  rides: readonly RideLite[],
  today: IsoDate,
  episodes: readonly SicknessEpisode[] = [],
): Levels {
  const levels = Object.fromEntries(ENERGY_SYSTEMS.map((s) => [s, START_LEVEL[experience]])) as Levels;
  const last: Partial<Record<EnergySystem, IsoDate>> = {};
  const ridesByDate = new Map<IsoDate, RideLite[]>();
  for (const r of rides) ridesByDate.set(r.date, [...(ridesByDate.get(r.date) ?? []), r]);

  for (const entry of [...log].filter((e) => e.date < today).sort((a, b) => (a.date < b.date ? -1 : 1))) {
    const system = SYSTEM_OF[entry.type];
    const done = ridesByDate.get(entry.date);
    if (!system || !done?.length) continue; // skipped days don't move levels
    const c = compliance(
      { load: entry.tss, seconds: entry.seconds },
      { load: done.reduce((s, r) => s + r.load, 0), seconds: done.reduce((s, r) => s + r.seconds, 0) },
    );
    const current = levels[system];
    if (c.status === 'completed') {
      const atLevel = entry.level >= current - 0.5;
      levels[system] = clamp(current + (!atLevel ? LEVEL_UP_EASY : c.over ? LEVEL_UP_OVER : LEVEL_UP));
    } else if (c.status === 'partial') {
      levels[system] = clamp(current - LEVEL_DOWN_PARTIAL);
    } else {
      levels[system] = clamp(current - LEVEL_DOWN_MISSED);
    }
    last[system] = entry.date;
  }

  for (const s of ENERGY_SYSTEMS) {
    const lastDate = last[s];
    if (!lastDate) continue;
    const idle = daysBetween(lastDate, today) - DECAY_AFTER_DAYS;
    if (idle > 0) levels[s] = clamp(levels[s] - Math.floor(idle / 7 + 1) * DECAY_PER_WEEK);
  }

  const penalty = levelPenalty(episodes, today);
  if (penalty > 0) for (const s of ENERGY_SYSTEMS) levels[s] = clamp(levels[s] - penalty);

  for (const s of ENERGY_SYSTEMS) levels[s] = Math.round(levels[s] * 10) / 10;
  return levels;
}

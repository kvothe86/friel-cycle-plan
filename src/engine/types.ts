import type { IsoDate } from '../lib/dates';

export type Specialty = 'allround' | 'climbing' | 'sprint' | 'tt' | 'endurance' | 'gravel';
export type EventType = 'road_race' | 'criterium' | 'time_trial' | 'gran_fondo' | 'gravel' | 'hill_climb' | 'stage_race';
export type Priority = 'A' | 'B' | 'C';
export type GoalKind = 'event' | 'specialty' | 'target';
export type TargetMetric = 'ftp' | 'ctl';

export interface Goal {
  id: string;
  kind: GoalKind;
  name: string;
  /** Event date or target date. Absent for specialty goals. */
  date?: IsoDate;
  priority: Priority;
  specialty: Specialty;
  eventType?: EventType;
  target?: { metric: TargetMetric; value: number };
  /** 'intervals' goals mirror RACE_A/B/C events from intervals.icu. */
  source: 'local' | 'intervals';
  icuEventId?: number;
}

export type RideMode = 'any' | 'indoor' | 'outdoor';

export interface DayAvailability {
  minutes: number;
  mode: RideMode;
}

/** Index 0 = Monday … 6 = Sunday. */
export type AvailabilityTemplate = [
  DayAvailability, DayAvailability, DayAvailability, DayAvailability,
  DayAvailability, DayAvailability, DayAvailability,
];

export interface AvailabilityOverride extends DayAvailability {
  date: IsoDate;
  note?: string;
}

export type Experience = 'novice' | 'intermediate' | 'advanced';

export interface PlanSettings {
  experience: Experience;
  /** Weeks per cycle including the recovery week: 4 = 3:1, 3 = 2:1. */
  cycleWeeks: 3 | 4;
  /** Preferred FTP test protocol. */
  ftpTest?: 'ramp' | 'ftp20';
}

export const DEFAULT_PLAN_SETTINGS: PlanSettings = { experience: 'intermediate', cycleWeeks: 4, ftpTest: 'ramp' };

export const DEFAULT_AVAILABILITY: AvailabilityTemplate = [
  { minutes: 0, mode: 'any' },
  { minutes: 60, mode: 'indoor' },
  { minutes: 0, mode: 'any' },
  { minutes: 60, mode: 'indoor' },
  { minutes: 0, mode: 'any' },
  { minutes: 120, mode: 'outdoor' },
  { minutes: 90, mode: 'outdoor' },
];

export const EVENT_SPECIALTY: Record<EventType, Specialty> = {
  road_race: 'allround',
  criterium: 'sprint',
  time_trial: 'tt',
  gran_fondo: 'endurance',
  gravel: 'gravel',
  hill_climb: 'climbing',
  stage_race: 'endurance',
};

export const SPECIALTY_LABELS: Record<Specialty, string> = {
  allround: 'All-round / FTP',
  climbing: 'Climbing',
  sprint: 'Sprint / crit',
  tt: 'Time trial',
  endurance: 'Endurance / fondo',
  gravel: 'Gravel',
};

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  road_race: 'Road race',
  criterium: 'Criterium',
  time_trial: 'Time trial',
  gran_fondo: 'Gran fondo',
  gravel: 'Gravel race',
  hill_climb: 'Hill climb',
  stage_race: 'Stage race',
};

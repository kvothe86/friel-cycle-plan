/**
 * Subset of the intervals.icu API shapes CyclingHub uses.
 * All fields are optional/nullable unless the API always sends them:
 * activities imported from Strava, for example, arrive as stubs.
 */

export interface IcuSportSettings {
  types?: string[];
  ftp?: number | null;
  indoor_ftp?: number | null;
  lthr?: number | null;
  max_hr?: number | null;
  w_prime?: number | null;
}

export interface IcuAthlete {
  id: string;
  name?: string | null;
  icu_weight?: number | null;
  icu_resting_hr?: number | null;
  timezone?: string | null;
  sportSettings?: IcuSportSettings[];
}

/** One wellness record per day. `id` is the ISO date (YYYY-MM-DD). */
export interface IcuWellness {
  id: string;
  ctl?: number | null;
  atl?: number | null;
  rampRate?: number | null;
  ctlLoad?: number | null;
  atlLoad?: number | null;
  weight?: number | null;
  restingHR?: number | null;
  hrv?: number | null; // rMSSD, ms
  hrvSDNN?: number | null;
  sleepSecs?: number | null;
  sleepScore?: number | null;
  sleepQuality?: number | null; // 1 great … 4 poor
  // Subjective scales: 1 = best … 4 = worst
  soreness?: number | null;
  fatigue?: number | null;
  stress?: number | null;
  mood?: number | null;
  motivation?: number | null;
  injury?: number | null;
  readiness?: number | null;
  updated?: string | null;
}

export interface IcuActivity {
  id: string;
  start_date_local: string; // "2026-11-09T18:02:11"
  type?: string | null; // Ride, VirtualRide, Run, WeightTraining, …
  name?: string | null;
  moving_time?: number | null; // s
  elapsed_time?: number | null; // s
  distance?: number | null; // m
  icu_training_load?: number | null;
  icu_intensity?: number | null; // IF × 100
  icu_weighted_avg_watts?: number | null;
  icu_average_watts?: number | null;
  icu_ftp?: number | null;
  average_heartrate?: number | null;
  icu_rpe?: number | null;
  paired_event_id?: number | null;
  source?: string | null;
}

export type IcuEventCategory =
  | 'WORKOUT' | 'RACE_A' | 'RACE_B' | 'RACE_C' | 'NOTE' | 'PLAN'
  | 'HOLIDAY' | 'SICK' | 'INJURED' | 'SET_EFTP' | 'FITNESS_DAYS' | 'SEASON_START' | 'TARGET' | 'SET_FITNESS'
  | (string & {});

export interface IcuEvent {
  id: number;
  category: IcuEventCategory;
  start_date_local: string; // "2027-04-18T00:00:00"
  end_date_local?: string | null;
  name?: string | null;
  type?: string | null;
  description?: string | null;
  external_id?: string | null;
  moving_time?: number | null;
  icu_training_load?: number | null;
  icu_intensity?: number | null;
}

/** Body for creating/updating a planned workout (POST /events/bulk). */
export interface IcuEventInput {
  category: 'WORKOUT';
  start_date_local: string;
  type: string;
  name: string;
  description: string;
  external_id: string;
  moving_time: number;
  icu_training_load: number;
}

/** Body for a SICK/INJURED marker (end date exclusive, at midnight). */
export interface IcuMarkerInput {
  category: 'SICK' | 'INJURED';
  start_date_local: string;
  end_date_local: string;
  name: string;
  description: string;
  external_id: string;
}

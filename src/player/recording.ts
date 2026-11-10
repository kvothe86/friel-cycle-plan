import type { Workout } from '../engine/workout';

/**
 * Ride recording: 1 Hz samples plus the summary maths (NP, IF, TSS) and
 * laps per workout step.
 */

export interface Sample {
  /** Epoch ms. */
  t: number;
  /** Workout seconds at this sample. */
  elapsed: number;
  power?: number;
  cadence?: number;
  heartRate?: number;
  speedKmh?: number;
  target?: number;
  segment: number;
}

export interface Recording {
  id: string;
  startedAt: number;
  workoutName: string;
  /** Planned date of the session (for pairing with the intervals.icu event). */
  plannedDate?: string;
  ftp: number;
  /** The planned workout, so an interrupted ride can be resumed. */
  workout: Workout;
  samples: Sample[];
  finished: boolean;
  uploadedActivityId?: string;
}

export interface RideStats {
  seconds: number;
  avgPower: number;
  maxPower: number;
  normalizedPower: number;
  intensityFactor: number;
  tss: number;
  kilojoules: number;
  avgHeartRate?: number;
  maxHeartRate?: number;
  avgCadence?: number;
  distanceM: number;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);

/** NP: 30 s rolling average, raised to the 4th power, averaged, 4th root. */
export function normalizedPower(powers: readonly number[]): number {
  if (powers.length < 30) return mean([...powers]);
  const rolled: number[] = [];
  let sum = 0;
  for (let i = 0; i < powers.length; i++) {
    sum += powers[i]!;
    if (i >= 30) sum -= powers[i - 30]!;
    if (i >= 29) rolled.push(sum / 30);
  }
  return mean(rolled.map((p) => p ** 4)) ** 0.25;
}

export function rideStats(samples: readonly Sample[], ftp: number): RideStats {
  const powers = samples.map((s) => s.power ?? 0);
  const hrs = samples.map((s) => s.heartRate).filter((x): x is number => !!x);
  const cads = samples.map((s) => s.cadence).filter((x): x is number => x !== undefined && x > 0);
  const np = normalizedPower(powers);
  const ifactor = ftp > 0 ? np / ftp : 0;
  const seconds = samples.length;
  return {
    seconds,
    avgPower: Math.round(mean(powers)),
    maxPower: Math.max(0, ...powers),
    normalizedPower: Math.round(np),
    intensityFactor: Math.round(ifactor * 100) / 100,
    tss: Math.round(((seconds * np * ifactor) / (ftp * 3600)) * 100) || 0,
    kilojoules: Math.round(powers.reduce((s, p) => s + p, 0) / 1000),
    avgHeartRate: hrs.length ? Math.round(mean(hrs)) : undefined,
    maxHeartRate: hrs.length ? Math.max(...hrs) : undefined,
    avgCadence: cads.length ? Math.round(mean(cads)) : undefined,
    distanceM: samples.reduce((s, x) => s + (x.speedKmh ?? 0) / 3.6, 0),
  };
}

export interface Lap {
  startIndex: number;
  endIndex: number; // exclusive
  segment: number;
}

/** One lap per contiguous run of samples in the same workout step. */
export function lapsOf(samples: readonly Sample[]): Lap[] {
  const laps: Lap[] = [];
  samples.forEach((s, i) => {
    const last = laps.at(-1);
    if (last && last.segment === s.segment) last.endIndex = i + 1;
    else laps.push({ startIndex: i, endIndex: i + 1, segment: s.segment });
  });
  return laps;
}

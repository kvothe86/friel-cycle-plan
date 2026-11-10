import type { SessionType } from './focus';

/**
 * Structured workout model. Power is a fraction of FTP (0.9 = 90 %), so a
 * workout is independent of the athlete's current FTP.
 */

export interface SteadyStep {
  kind: 'steady';
  seconds: number;
  power: number;
  label?: string;
  cadence?: number;
}

export interface RampStep {
  kind: 'ramp';
  seconds: number;
  from: number;
  to: number;
  label?: string;
}

export type Step = SteadyStep | RampStep;

export interface Block {
  label: string;
  repeat: number;
  steps: Step[];
}

/** Zone guidance for outdoor rides (PLAN §3.5): no intervals, just targets. */
export interface OutdoorGuidance {
  summary: string;
  /** Main zone, e.g. 2 for endurance. */
  zone: number;
  /** Minimum share of moving time in `zone` or below. */
  minShareInZone?: number;
  /** Highest zone that is fine to touch briefly. */
  maxZone: number;
}

export type Intensity = 'recovery' | 'easy' | 'moderate' | 'hard';

export interface Workout {
  templateId: string;
  type: SessionType;
  name: string;
  description: string;
  intensity: Intensity;
  blocks: Block[];
  seconds: number;
  tss: number;
  intensityFactor: number;
  level: number;
  outdoor?: OutdoorGuidance;
}

/** Coggan power zones as fractions of FTP (upper bounds). */
export const POWER_ZONES = [
  { zone: 1, name: 'Active recovery', max: 0.55, color: '#94a3b8' },
  { zone: 2, name: 'Endurance', max: 0.75, color: '#38bdf8' },
  { zone: 3, name: 'Tempo', max: 0.9, color: '#22c55e' },
  { zone: 4, name: 'Threshold', max: 1.05, color: '#eab308' },
  { zone: 5, name: 'VO2max', max: 1.2, color: '#f97316' },
  { zone: 6, name: 'Anaerobic', max: 1.5, color: '#ef4444' },
  { zone: 7, name: 'Neuromuscular', max: Infinity, color: '#a855f7' },
] as const;

/** Lower bound (fraction of FTP) of each zone. */
export const ZONE_FLOOR = [0, 0.56, 0.76, 0.91, 1.06, 1.21, 1.51] as const;

export function zoneOf(power: number): (typeof POWER_ZONES)[number] {
  return POWER_ZONES.find((z) => power <= z.max + 1e-9) ?? POWER_ZONES[6];
}

/** Mean of power² over a step (exact for ramps). */
function meanSquare(s: Step): number {
  return s.kind === 'steady' ? s.power ** 2 : (s.from ** 2 + s.from * s.to + s.to ** 2) / 3;
}

export function flatten(blocks: readonly Block[]): Step[] {
  return blocks.flatMap((b) => Array.from({ length: b.repeat }, () => b.steps).flat());
}

export function totalSeconds(blocks: readonly Block[]): number {
  return flatten(blocks).reduce((s, x) => s + x.seconds, 0);
}

/**
 * TSS from the planned steps: Σ hours × IF² × 100, with IF per step.
 * Close to NP-based TSS for structured work; slightly low for very spiky sessions.
 */
export function workoutTss(blocks: readonly Block[]): number {
  return flatten(blocks).reduce((s, x) => s + (x.seconds / 3600) * meanSquare(x) * 100, 0);
}

export function intensityFactor(blocks: readonly Block[]): number {
  const secs = totalSeconds(blocks);
  return secs > 0 ? Math.sqrt(workoutTss(blocks) / ((secs / 3600) * 100)) : 0;
}

/** Seconds per zone (index 0 = Z1). Ramps are split at their mean power. */
export function timeInZones(blocks: readonly Block[]): number[] {
  const out = [0, 0, 0, 0, 0, 0, 0];
  for (const s of flatten(blocks)) {
    const p = s.kind === 'steady' ? s.power : (s.from + s.to) / 2;
    out[zoneOf(p).zone - 1]! += s.seconds;
  }
  return out;
}

export function intensityFor(ifactor: number, maxPower: number): Intensity {
  if (maxPower >= 0.95 && ifactor >= 0.75) return 'hard';
  if (ifactor >= 0.75 || maxPower >= 0.88) return 'moderate';
  if (ifactor >= 0.6) return 'easy';
  return 'recovery';
}

export function maxPower(blocks: readonly Block[]): number {
  return Math.max(0, ...flatten(blocks).map((s) => (s.kind === 'steady' ? s.power : Math.max(s.from, s.to))));
}

export function isHard(w: Pick<Workout, 'intensity'>): boolean {
  return w.intensity === 'hard';
}

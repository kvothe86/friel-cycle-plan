import { flatten, type Workout } from '../engine/workout';

/**
 * ERG player engine (PLAN §5): pure session state. The UI ticks it once a
 * second; it answers "which step, what target, how long left".
 */

export interface Segment {
  start: number;
  end: number;
  /** Fractions of FTP; equal for steady steps. */
  from: number;
  to: number;
  label: string;
}

export type SessionStatus = 'ready' | 'running' | 'paused' | 'finished';

export interface Session {
  segments: Segment[];
  /** Seconds of workout progressed (pauses don't count). */
  elapsed: number;
  status: SessionStatus;
  /** Intensity multiplier, 1 = as planned. */
  intensity: number;
  erg: boolean;
}

export const INTENSITY_STEP = 0.05;
export const MIN_INTENSITY = 0.5;
export const MAX_INTENSITY = 1.25;
export const EXTEND_SECONDS = 60;
/** Low-cadence protection: below this for a few seconds, ERG target is cut. */
export const LOW_CADENCE_RPM = 55;
export const LOW_CADENCE_SECONDS = 3;
export const LOW_CADENCE_RECOVERED_RPM = 70;
export const LOW_CADENCE_TARGET_FACTOR = 0.6;
/** Target changes are eased: within this many watts we jump, otherwise halve the gap each second. */
export const SMOOTH_SNAP_WATTS = 5;

export function buildSegments(workout: Workout): Segment[] {
  let t = 0;
  return flatten(workout.blocks).map((s) => {
    const seg: Segment =
      s.kind === 'steady'
        ? { start: t, end: t + s.seconds, from: s.power, to: s.power, label: s.label ?? '' }
        : { start: t, end: t + s.seconds, from: s.from, to: s.to, label: s.label ?? '' };
    t += s.seconds;
    return seg;
  });
}

export function newSession(workout: Workout): Session {
  return { segments: buildSegments(workout), elapsed: 0, status: 'ready', intensity: 1, erg: true };
}

export const totalSeconds = (s: Session) => s.segments.at(-1)?.end ?? 0;

export function segmentIndexAt(segments: readonly Segment[], t: number): number {
  const i = segments.findIndex((s) => t < s.end);
  return i === -1 ? segments.length - 1 : i;
}

/** Fraction of FTP at time t (ramps interpolate). */
export function fractionAt(segments: readonly Segment[], t: number): number {
  const seg = segments[segmentIndexAt(segments, t)];
  if (!seg) return 0;
  const p = seg.end > seg.start ? Math.min(1, Math.max(0, (t - seg.start) / (seg.end - seg.start))) : 0;
  return seg.from + (seg.to - seg.from) * p;
}

export interface Position {
  index: number;
  segment: Segment;
  next?: Segment;
  remainingInSegment: number;
  remainingTotal: number;
  fraction: number;
}

export function position(s: Session): Position | null {
  if (s.segments.length === 0) return null;
  const index = segmentIndexAt(s.segments, s.elapsed);
  const segment = s.segments[index]!;
  return {
    index,
    segment,
    next: s.segments[index + 1],
    remainingInSegment: Math.max(0, segment.end - s.elapsed),
    remainingTotal: Math.max(0, totalSeconds(s) - s.elapsed),
    fraction: fractionAt(s.segments, s.elapsed) * s.intensity,
  };
}

export function start(s: Session): Session {
  return s.status === 'finished' ? s : { ...s, status: 'running' };
}
export function pause(s: Session): Session {
  return s.status === 'running' ? { ...s, status: 'paused' } : s;
}

export function tick(s: Session, dt = 1): Session {
  if (s.status !== 'running') return s;
  const elapsed = Math.min(totalSeconds(s), s.elapsed + dt);
  return { ...s, elapsed, status: elapsed >= totalSeconds(s) ? 'finished' : 'running' };
}

/** Jumps to the start of the next step (or finishes on the last). */
export function skip(s: Session): Session {
  const i = segmentIndexAt(s.segments, s.elapsed);
  const next = s.segments[i + 1];
  if (!next) return { ...s, elapsed: totalSeconds(s), status: 'finished' };
  return { ...s, elapsed: next.start };
}

/** Adds time to the current step; later steps shift. */
export function extend(s: Session, seconds = EXTEND_SECONDS): Session {
  const i = segmentIndexAt(s.segments, s.elapsed);
  const segments = s.segments.map((seg, j) =>
    j < i ? seg : j === i ? { ...seg, end: seg.end + seconds } : { ...seg, start: seg.start + seconds, end: seg.end + seconds },
  );
  return { ...s, segments, status: s.status === 'finished' ? 'running' : s.status };
}

export function changeIntensity(s: Session, delta: number): Session {
  const intensity = Math.round(Math.min(MAX_INTENSITY, Math.max(MIN_INTENSITY, s.intensity + delta)) * 100) / 100;
  return { ...s, intensity };
}

export function toggleErg(s: Session): Session {
  return { ...s, erg: !s.erg };
}

/** Eases target changes so ERG doesn't slam the legs. */
export function smoothTarget(previous: number | null, desired: number): number {
  if (previous === null || Math.abs(desired - previous) <= SMOOTH_SNAP_WATTS) return Math.round(desired);
  return Math.round(previous + (desired - previous) / 2);
}

/**
 * Low-cadence protection against the ERG "death spiral": after a few
 * seconds below the threshold the target drops until cadence recovers.
 */
export interface CadenceGuard {
  lowSeconds: number;
  active: boolean;
}

export function updateCadenceGuard(guard: CadenceGuard, cadence: number | undefined): CadenceGuard {
  if (cadence === undefined) return guard;
  if (guard.active) return cadence >= LOW_CADENCE_RECOVERED_RPM ? { lowSeconds: 0, active: false } : guard;
  // Not pedalling at all (0 rpm) is treated as a pause by the rider, not a spiral.
  const low = cadence > 0 && cadence < LOW_CADENCE_RPM;
  const lowSeconds = low ? guard.lowSeconds + 1 : 0;
  return { lowSeconds, active: lowSeconds >= LOW_CADENCE_SECONDS };
}

export function targetWatts(s: Session, ftp: number, guard: CadenceGuard): number {
  const pos = position(s);
  if (!pos) return 0;
  const w = pos.fraction * ftp;
  return Math.round(guard.active ? w * LOW_CADENCE_TARGET_FACTOR : w);
}

import { addDays, type IsoDate } from '../lib/dates';
import type { IcuWellness } from '../integrations/intervals/types';

/**
 * Daily readiness (PLAN §3.1). Each available signal gets a 0–100 score;
 * missing signals are skipped and the weights renormalised.
 */

export type SignalKey = 'hrv' | 'rhr' | 'sleep' | 'form' | 'subjective';

export const SIGNAL_WEIGHTS: Record<SignalKey, number> = {
  hrv: 0.3,
  rhr: 0.2,
  sleep: 0.15,
  form: 0.2,
  subjective: 0.15,
};

export const HRV_BASELINE_DAYS = 60;
export const HRV_MIN_BASELINE_VALUES = 14;
export const RHR_BASELINE_DAYS = 30;
export const RHR_MIN_BASELINE_VALUES = 7;

/** Sickness heuristic thresholds (PLAN §2.5 auto-detect suggestion). */
export const SICK_HRV_Z = -1.5;
export const SICK_RHR_DELTA = 5;

export type ReadinessLabel = 'low' | 'reduced' | 'normal' | 'high';

export interface SignalScore {
  key: SignalKey;
  score: number;
  detail: string;
}

export interface Readiness {
  date: IsoDate;
  /** null when no signal is available at all. */
  score: number | null;
  label: ReadinessLabel | null;
  signals: SignalScore[];
  missing: SignalKey[];
  sickSuspected: boolean;
}

const clamp = (v: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, v));
const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
const sd = (xs: number[]) => {
  const m = mean(xs);
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / Math.max(1, xs.length - 1));
};
const isNum = (v: number | null | undefined): v is number => typeof v === 'number' && Number.isFinite(v);

export function labelFor(score: number): ReadinessLabel {
  if (score < 40) return 'low';
  if (score < 60) return 'reduced';
  if (score < 80) return 'normal';
  return 'high';
}

type ByDate = ReadonlyMap<IsoDate, IcuWellness>;

function windowValues(byDate: ByDate, date: IsoDate, days: number, pick: (w: IcuWellness) => number | null | undefined) {
  const out: number[] = [];
  for (let i = 1; i <= days; i++) {
    const v = pick(byDate.get(addDays(date, -i)) ?? ({} as IcuWellness));
    if (isNum(v) && v > 0) out.push(v);
  }
  return out;
}

/** z-score of today's ln(rMSSD) against the 60-day baseline. */
export function hrvZ(byDate: ByDate, date: IsoDate): number | null {
  const today = byDate.get(date)?.hrv;
  if (!isNum(today) || today <= 0) return null;
  const base = windowValues(byDate, date, HRV_BASELINE_DAYS, (w) => w.hrv).map(Math.log);
  if (base.length < HRV_MIN_BASELINE_VALUES) return null;
  const s = sd(base);
  if (s === 0) return 0;
  return (Math.log(today) - mean(base)) / s;
}

/** Today's resting HR minus the 30-day mean (bpm). */
export function rhrDelta(byDate: ByDate, date: IsoDate): number | null {
  const today = byDate.get(date)?.restingHR;
  if (!isNum(today) || today <= 0) return null;
  const base = windowValues(byDate, date, RHR_BASELINE_DAYS, (w) => w.restingHR);
  if (base.length < RHR_MIN_BASELINE_VALUES) return null;
  return today - mean(base);
}

function hrvSignal(byDate: ByDate, date: IsoDate): SignalScore | null {
  const zToday = hrvZ(byDate, date);
  if (zToday === null) return null;
  // Smooth with the 7-day trend so one odd morning doesn't dominate.
  const recent = [0, 1, 2, 3, 4, 5, 6].map((i) => hrvZ(byDate, addDays(date, -i))).filter(isNum);
  const z = 0.5 * zToday + 0.5 * mean(recent);
  const hrv = byDate.get(date)!.hrv!;
  return { key: 'hrv', score: clamp(75 + 25 * z), detail: `${Math.round(hrv)} ms (z ${z.toFixed(1)})` };
}

function rhrSignal(byDate: ByDate, date: IsoDate): SignalScore | null {
  const delta = rhrDelta(byDate, date);
  if (delta === null) return null;
  const rhr = byDate.get(date)!.restingHR!;
  const sign = delta >= 0 ? '+' : '';
  return { key: 'rhr', score: clamp(80 - delta * 6), detail: `${Math.round(rhr)} bpm (${sign}${delta.toFixed(1)})` };
}

function sleepSignal(w: IcuWellness | undefined): SignalScore | null {
  if (!w) return null;
  const parts: number[] = [];
  const details: string[] = [];
  if (isNum(w.sleepSecs) && w.sleepSecs > 0) {
    const h = w.sleepSecs / 3600;
    parts.push(clamp(((h - 4) / 4) * 100));
    details.push(`${Math.floor(h)}h${String(Math.round((h % 1) * 60)).padStart(2, '0')}`);
  }
  if (isNum(w.sleepScore) && w.sleepScore > 0) {
    parts.push(clamp(w.sleepScore));
    details.push(`score ${Math.round(w.sleepScore)}`);
  }
  if (parts.length === 0) return null;
  return { key: 'sleep', score: mean(parts), detail: details.join(', ') };
}

function formSignal(tsb: number | null | undefined): SignalScore | null {
  if (!isNum(tsb)) return null;
  return { key: 'form', score: clamp(80 + tsb * 2), detail: `TSB ${tsb >= 0 ? '+' : ''}${Math.round(tsb)}` };
}

/** intervals.icu subjective fields use 1 = best … 4 = worst. */
function subjectiveSignal(w: IcuWellness | undefined): SignalScore | null {
  if (!w) return null;
  const fields = ['soreness', 'fatigue', 'stress', 'mood', 'motivation'] as const;
  const vals = fields.map((f) => w[f]).filter((v): v is number => isNum(v) && v >= 1 && v <= 4);
  if (vals.length === 0) return null;
  const score = mean(vals.map((v) => ((4 - v) / 3) * 100));
  return { key: 'subjective', score, detail: `${vals.length} check-in field${vals.length > 1 ? 's' : ''}` };
}

function looksSick(byDate: ByDate, date: IsoDate): boolean {
  const z = hrvZ(byDate, date);
  const d = rhrDelta(byDate, date);
  return z !== null && d !== null && z <= SICK_HRV_Z && d >= SICK_RHR_DELTA;
}

export function computeReadiness(
  wellness: readonly IcuWellness[],
  date: IsoDate,
  tsb?: number | null,
): Readiness {
  const byDate: ByDate = new Map(wellness.map((w) => [w.id, w]));
  const today = byDate.get(date);
  const formTsb = isNum(tsb) ? tsb : isNum(today?.ctl) && isNum(today?.atl) ? today.ctl - today.atl : null;

  const candidates: Record<SignalKey, SignalScore | null> = {
    hrv: hrvSignal(byDate, date),
    rhr: rhrSignal(byDate, date),
    sleep: sleepSignal(today),
    form: formSignal(formTsb),
    subjective: subjectiveSignal(today),
  };

  const signals = Object.values(candidates).filter((s): s is SignalScore => s !== null);
  const missing = (Object.keys(candidates) as SignalKey[]).filter((k) => candidates[k] === null);

  let score: number | null = null;
  if (signals.length > 0) {
    const totalWeight = signals.reduce((s, x) => s + SIGNAL_WEIGHTS[x.key], 0);
    score = Math.round(signals.reduce((s, x) => s + x.score * SIGNAL_WEIGHTS[x.key], 0) / totalWeight);
  }

  return {
    date,
    score,
    label: score === null ? null : labelFor(score),
    signals,
    missing,
    sickSuspected: looksSick(byDate, date) && looksSick(byDate, addDays(date, -1)),
  };
}

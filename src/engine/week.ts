import { addDays, type IsoDate } from '../lib/dates';
import type { ResolvedDay } from './availability';
import { phaseFocus, type SessionType } from './focus';
import { buildWorkout, canRideOutdoor, enduranceTssPerHour, MAX_ENDURANCE_POWER, minMinutesFor } from './library';
import type { PlanWeek, SeasonPlan } from './macro';
import type { Experience, RideMode, Specialty } from './types';
import { isHard, type Workout } from './workout';
import type { FixedWorkout } from './push';

/**
 * Week planner + day allocator (PLAN §3.3–3.4): turns a week's load target
 * and the available days into concrete sessions. Pure and deterministic.
 */

export const BASE_LEVEL: Record<Experience, number> = { novice: 3, intermediate: 4, advanced: 6 };
export const KEY_SESSIONS: Record<PlanWeek['phase'], number> = { base: 2, build: 3, peak: 2, race: 0 };
export const MAX_KEY_MINUTES = 90;
export const RECOVERY_WEEK_MAX_MINUTES = 60;
export const MIN_SESSION_MINUTES = 20;
export const LONG_RIDE_MIN_MINUTES = 90;
/** Share of the remaining weekly load the long ride aims for. */
export const LONG_RIDE_LOAD_SHARE = 0.4;

/** A completed activity, reduced to what planning needs. */
export interface DoneActivity {
  date: IsoDate;
  name: string;
  load: number;
  /** Counts as a hard day (PLAN §3.1: other sports included). */
  hard: boolean;
  /** Only rides complete the day; other sports add load and fatigue but leave the ride on. */
  cycling: boolean;
}

export type DayKind = 'workout' | 'rest' | 'event' | 'done' | 'fixed';

export interface DayPlan {
  date: IsoDate;
  kind: DayKind;
  workout?: Workout;
  key: boolean;
  reason: string;
  availableMinutes: number;
  mode: RideMode;
  /** Days after today are a forecast and may change. */
  tentative: boolean;
  event?: { name: string; priority: 'A' | 'B' | 'C' };
  done?: DoneActivity[];
  /** The user's own workout in intervals.icu, planned around. */
  fixed?: FixedWorkout;
  phase: PlanWeek['phase'];
  recoveryWeek: boolean;
}

export interface WeekPlanInput {
  week: PlanWeek;
  /** Days of this week to plan (today or later), with resolved availability. */
  days: readonly ResolvedDay[];
  today: IsoDate;
  specialty: Specialty;
  experience: Experience;
  /** Completed activities from the day before the week up to today. */
  done: readonly DoneActivity[];
  /** Weeks since the current phase started (drives progression in M3). */
  weeksIntoPhase: number;
  /** Workouts in intervals.icu the plan must respect. */
  fixed?: readonly FixedWorkout[];
}

/** Hard-day rule for completed activities (cycling and other sports). */
export function isHardActivity(a: { load?: number | null; intensity?: number | null; rpe?: number | null; cycling: boolean }): boolean {
  const load = a.load ?? 0;
  if (a.cycling) return (a.intensity ?? 0) >= 85 || (load >= 120 && (a.intensity ?? 0) >= 80);
  return load >= 70 || (a.rpe ?? 0) >= 7;
}

const round5 = (m: number) => Math.round(m / 5) * 5;

/** Longest day wins; ties go to outdoor days for long rides and indoor days for intervals. */
function dayScore(d: ResolvedDay, isLong: boolean): number {
  const preferred = isLong ? d.mode === 'outdoor' : d.mode === 'indoor';
  return d.minutes + (preferred ? 0.5 : 0);
}

function levelFor(input: WeekPlanInput): number {
  const base = BASE_LEVEL[input.experience] + Math.floor(input.weeksIntoPhase / 2);
  return Math.min(10, Math.max(1, input.week.recovery ? base - 2 : base));
}

export function planWeek(input: WeekPlanInput): DayPlan[] {
  const { week, days, today, specialty, done } = input;
  const level = levelFor(input);
  const weekEnd = addDays(week.start, 6);
  const doneInWeek = done.filter((d) => d.date >= week.start && d.date <= weekEnd);
  const doneByDate = new Map<IsoDate, DoneActivity[]>();
  for (const d of done) doneByDate.set(d.date, [...(doneByDate.get(d.date) ?? []), d]);

  const hardDates = new Set(done.filter((d) => d.hard).map((d) => d.date));
  const eventsByDate = new Map(week.events.map((e) => [e.date, e]));
  for (const e of week.events) hardDates.add(e.date); // racing is hard

  const fixedByDate = new Map((input.fixed ?? []).filter((f) => f.date >= today).map((f) => [f.date, f]));
  for (const f of fixedByDate.values()) if (f.hard) hardDates.add(f.date);

  const doneLoad = doneInWeek.reduce((s, d) => s + d.load, 0);
  const fixedLoad = days.reduce((s, d) => s + (fixedByDate.get(d.date)?.load ?? 0), 0);
  let remaining = Math.max(0, week.targetTss - doneLoad - fixedLoad);

  const plans = new Map<IsoDate, DayPlan>();
  const base = (d: ResolvedDay): Omit<DayPlan, 'kind' | 'reason' | 'key'> => ({
    date: d.date, availableMinutes: d.minutes, mode: d.mode, tentative: d.date > today, phase: week.phase, recoveryWeek: week.recovery,
  });

  // 1. Fixed days: today's completed ride, events, no time.
  const candidates: ResolvedDay[] = [];
  for (const d of days) {
    const ev = eventsByDate.get(d.date);
    const doneToday = d.date === today ? doneByDate.get(d.date) : undefined;
    if (doneToday?.some((a) => a.cycling)) {
      plans.set(d.date, { ...base(d), kind: 'done', key: false, done: doneToday, reason: 'Already ridden today.' });
    } else if (fixedByDate.has(d.date)) {
      const f = fixedByDate.get(d.date)!;
      plans.set(d.date, {
        ...base(d), kind: 'fixed', key: f.hard, fixed: f,
        reason: `Your own workout in intervals.icu (${f.name}${f.load ? `, ${Math.round(f.load)} TSS` : ''}). The plan works around it.`,
      });
    } else if (ev) {
      plans.set(d.date, { ...base(d), kind: 'event', key: true, event: { name: ev.name, priority: ev.priority }, reason: `${ev.priority} event: ${ev.name}.` });
    } else if (d.minutes < MIN_SESSION_MINUTES) {
      const why = d.source === 'blocked' ? `No training: ${d.note ?? 'blocked'}.` : d.source === 'override' && d.note ? `No training: ${d.note}.` : 'Rest: no time available.';
      plans.set(d.date, { ...base(d), kind: 'rest', key: false, reason: why });
    } else {
      candidates.push(d);
    }
  }

  const ctx = (d: ResolvedDay) => ({ level, specialty, outdoor: d.mode === 'outdoor' });
  const isFree = (d: ResolvedDay) => !plans.has(d.date);
  // A hard day the day before, after, or the same day (e.g. a hard run this morning) rules out intensity.
  const nextToHard = (date: IsoDate) => hardDates.has(addDays(date, -1)) || hardDates.has(date) || hardDates.has(addDays(date, 1));

  // 2. Openers the day before an A/B event.
  for (const e of week.events.filter((x) => x.priority !== 'C')) {
    const d = candidates.find((c) => c.date === addDays(e.date, -1));
    if (d && isFree(d) && d.minutes >= minMinutesFor('openers')) {
      const w = buildWorkout('openers', Math.min(d.minutes, 45), ctx(d));
      plans.set(d.date, { ...base(d), kind: 'workout', workout: w, key: false, reason: `Openers: ${e.name} is tomorrow.` });
      remaining = Math.max(0, remaining - w.tss);
    }
  }

  // 3. Key sessions on the longest suitable days.
  const focus = phaseFocus(week.phase, specialty);
  // Hard rides already done and the user's own hard workouts count as key sessions.
  const hardDone = doneInWeek.filter((d) => d.hard).length + [...fixedByDate.values()].filter((f) => f.hard).length;
  const keys: SessionType[] = week.recovery
    ? focus.keySessions.filter((t) => t !== 'long').slice(0, 1)
    : focus.keySessions.slice(0, KEY_SESSIONS[week.phase]);
  // Hard sessions already ridden this week replace the lowest-priority interval keys.
  for (let i = keys.length - 1, drop = hardDone; i >= 0 && drop > 0; i--) {
    if (keys[i] !== 'long') {
      keys.splice(i, 1);
      drop--;
    }
  }
  const maxHard = Math.floor((candidates.length + 1) / 2);
  const totalKeys = keys.length;

  // The long ride claims the longest day first; interval keys then take the longest of the rest.
  const ordered = [...keys].sort((a, b) => (a === 'long' ? -1 : b === 'long' ? 1 : 0));
  let hardPlaced = 0;
  let keyNo = 0;
  for (const type of ordered) {
    const isLong = type === 'long';
    if (!isLong && hardPlaced >= maxHard) continue;
    const options = candidates
      .filter(isFree)
      .filter((d) => d.minutes >= (isLong ? LONG_RIDE_MIN_MINUTES : minMinutesFor(type, d.mode === 'outdoor')))
      .filter((d) => (d.mode === 'outdoor' ? canRideOutdoor(type) : true))
      .filter((d) => isLong || !nextToHard(d.date))
      .sort((a, b) => dayScore(b, isLong) - dayScore(a, isLong) || (a.date < b.date ? -1 : 1));
    const d = options[0];
    if (!d) continue;

    const cap = week.recovery ? RECOVERY_WEEK_MAX_MINUTES : MAX_KEY_MINUTES;
    const minutes = isLong
      ? round5(Math.min(d.minutes, Math.max(LONG_RIDE_MIN_MINUTES, ((remaining * LONG_RIDE_LOAD_SHARE) / enduranceTssPerHour(level)) * 60)))
      : round5(Math.min(d.minutes, cap));
    const w = buildWorkout(type, minutes, ctx(d), week.index);
    keyNo++;
    plans.set(d.date, {
      ...base(d), kind: 'workout', workout: w, key: true,
      reason: isLong
        ? `Long ride on your longest${d.mode === 'outdoor' ? ' outdoor' : ''} day (${week.phase} phase).`
        : `Key session ${keyNo} of ${totalKeys}: ${focus.summary.toLowerCase()} (${week.phase}${week.recovery ? ', recovery week' : ''}). Placed on your longest free day with no hard day next to it.`,
    });
    if (isHard(w)) {
      hardDates.add(d.date);
      hardPlaced++;
    }
    remaining = Math.max(0, remaining - w.tss);
  }

  // 4. Remaining days: endurance or recovery to reach the weekly load.
  const rest = candidates.filter(isFree);
  const restMinutes = rest.reduce((s, d) => s + d.minutes, 0);
  // If plain Z2 can't reach the weekly load in the time left, ride upper Z2 instead.
  const baseRate = enduranceTssPerHour(level);
  const neededRate = restMinutes > 0 ? remaining / (restMinutes / 60) : 0;
  const endurancePower = neededRate > baseRate ? Math.min(MAX_ENDURANCE_POWER, Math.sqrt(neededRate / 100)) : undefined;
  const tssPerHour = endurancePower ? endurancePower ** 2 * 100 : baseRate;
  const target = remaining;
  for (const d of rest) {
    const share = restMinutes > 0 ? (target * d.minutes) / restMinutes : 0;
    const afterHard = hardDates.has(addDays(d.date, -1));
    let minutes = round5(Math.min(d.minutes, (share / tssPerHour) * 60));
    if (afterHard) minutes = Math.min(minutes, 60);
    if (minutes < 30) {
      plans.set(d.date, {
        ...base(d), kind: 'rest', key: false,
        reason: share < 1 ? 'Rest: the weekly load target is already covered.' : 'Rest: too little load left for a useful ride. Recover instead.',
      });
      continue;
    }
    const type: SessionType = afterHard && minutes <= 45 ? 'recovery' : 'endurance';
    const w = buildWorkout(type, minutes, { ...ctx(d), ...(type === 'endurance' && endurancePower && { endurancePower }) });
    plans.set(d.date, {
      ...base(d), kind: 'workout', workout: w, key: false,
      reason: afterHard
        ? 'Easy day after a hard session: recover while adding aerobic volume.'
        : `Endurance to build the weekly load (target ${week.targetTss} TSS).`,
    });
    remaining = Math.max(0, remaining - w.tss);
  }

  // 5. At least one rest day per full week (PLAN §3.7).
  const result = days.map((d) => plans.get(d.date)!);
  if (days.length === 7 && result.every((p) => p.kind !== 'rest')) {
    const easiest = result
      .filter((p) => p.kind === 'workout' && !p.key && p.date > today)
      .sort((a, b) => (a.workout?.tss ?? 0) - (b.workout?.tss ?? 0))[0];
    if (easiest) Object.assign(easiest, { kind: 'rest', workout: undefined, reason: 'Rest: at least one day off per week.' });
  }
  return result;
}

export interface HorizonInput {
  today: IsoDate;
  plan: SeasonPlan;
  /** Resolved availability for the horizon, starting today. */
  days: readonly ResolvedDay[];
  /** Completed activities from the Monday before today's week up to today. */
  done: readonly DoneActivity[];
  experience: Experience;
  fixed?: readonly FixedWorkout[];
}

/** Plans each week overlapping the horizon (PLAN §3.6: re-run on every change). */
export function planHorizon({ today, plan, days, done, experience, fixed = [] }: HorizonInput): DayPlan[] {
  const out: DayPlan[] = [];
  for (const week of plan.weeks) {
    const weekEnd = addDays(week.start, 6);
    const weekDays = days.filter((d) => d.date >= week.start && d.date <= weekEnd);
    if (weekDays.length === 0) continue;
    let weeksIntoPhase = 0;
    for (let i = week.index - 1; i >= 0 && plan.weeks[i]!.phase === week.phase; i--) weeksIntoPhase++;
    out.push(...planWeek({
      week, days: weekDays, today, specialty: plan.specialty, experience,
      done: done.filter((d) => d.date >= addDays(week.start, -1) && d.date <= weekEnd),
      weeksIntoPhase,
      fixed: fixed.filter((f) => f.date >= week.start && f.date <= weekEnd),
    }));
  }
  return out;
}

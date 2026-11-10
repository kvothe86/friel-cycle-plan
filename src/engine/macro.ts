import { addDays, daysBetween, startOfWeek, type IsoDate } from '../lib/dates';
import { templateMinutes, weeklyMinutes, type BlockedRange } from './availability';
import type {
  AvailabilityOverride, AvailabilityTemplate, Experience, Goal, PlanSettings, Priority, Specialty,
} from './types';

/**
 * Macro planner (PLAN §3.2): goal → phases → weekly load and target CTL.
 * Pure and deterministic: same inputs, same plan.
 */

export type Phase = 'base' | 'build' | 'peak' | 'race';

/** CTL gained per loading week, before phase factors. */
export const RAMP_PER_WEEK: Record<Experience, number> = { novice: 3, intermediate: 5, advanced: 7 };
export const BASE_RAMP_FACTOR = 0.8;
/** Upper bound of training load per available hour (mixed endurance/intensity). */
export const TSS_PER_HOUR = 65;
/** Share of available time that is realistically used. */
export const USABLE_FRACTION = 0.9;
export const RECOVERY_WEEK_LOAD = 0.6;
/** Peak weeks, in order, as a share of the last loading week. */
export const PEAK_WEEK_LOADS = [0.85, 0.7] as const;
export const RACE_WEEK_LOAD = 0.5;
export const B_EVENT_WEEK_LOAD = 0.75;
export const MAX_BUILD_WEEKS = 8;
export const ROLLING_WEEKS = 16;
/** Fixed Monday anchoring rolling blocks, so they don't shift day to day. */
export const ROLLING_EPOCH: IsoDate = '2024-01-01';

/** CTL retained after 7 days without load. */
const WEEK_DECAY = (1 - 1 / 42) ** 7;

export interface WeekEvent {
  goalId: string;
  name: string;
  date: IsoDate;
  priority: Priority;
}

export interface PlanWeek {
  index: number;
  start: IsoDate;
  phase: Phase;
  recovery: boolean;
  availableMinutes: number;
  targetTss: number;
  /** Target CTL at the end of the week. */
  targetCtl: number;
  /** True when available time, not the ramp, set the load. */
  timeLimited: boolean;
  events: WeekEvent[];
}

export interface SeasonPlan {
  mode: 'event' | 'rolling';
  goal: Goal | null;
  specialty: Specialty;
  startCtl: number;
  peakCtl: number;
  /** Steady-state CTL the weekly template can sustain. */
  sustainableCtl: number;
  weeks: PlanWeek[];
  warnings: string[];
}

export interface MacroInput {
  today: IsoDate;
  goals: readonly Goal[];
  currentCtl: number;
  template: AvailabilityTemplate;
  overrides: readonly AvailabilityOverride[];
  blocked?: readonly BlockedRange[];
  settings: PlanSettings;
}

/** CTL after one week of evenly spread weekly load. */
export function ctlAfterWeek(ctl: number, weeklyTss: number): number {
  const daily = weeklyTss / 7;
  return daily + (ctl - daily) * WEEK_DECAY;
}

/** Weekly load needed to move CTL from `from` to `to` in one week. */
export function weeklyLoadFor(from: number, to: number): number {
  return Math.max(0, (7 * (to - from * WEEK_DECAY)) / (1 - WEEK_DECAY));
}

export function sustainableCtl(weeklyMinutes: number): number {
  return ((weeklyMinutes / 60) * TSS_PER_HOUR * USABLE_FRACTION) / 7;
}

/** Splits `n` weeks (the last one containing the event) into phases. */
export function allocatePhases(n: number): Phase[] {
  if (n <= 0) return [];
  const peak = Math.min(PEAK_WEEK_LOADS.length, n - 1);
  const rem = n - 1 - peak;
  const build = rem <= 4 ? rem : Math.min(MAX_BUILD_WEEKS, Math.ceil(rem / 2));
  const base = rem - build;
  return [
    ...Array<Phase>(base).fill('base'),
    ...Array<Phase>(build).fill('build'),
    ...Array<Phase>(peak).fill('peak'),
    'race',
  ];
}

/**
 * Recovery weeks in base/build, counted back from the end of build so the
 * last loading weeks lead straight into the peak. The current week (index 0)
 * is never a recovery week: a plan doesn't start by backing off.
 */
export function markRecovery(phases: readonly Phase[], cycleWeeks: number): boolean[] {
  const lastLoad = phases.findLastIndex((p) => p === 'base' || p === 'build');
  return phases.map((p, i) => i > 0 && (p === 'base' || p === 'build') && (lastLoad - i + 1) % cycleWeeks === 0);
}

function rollingPhases(firstMonday: IsoDate, weeks: number, cycleWeeks: number) {
  const epochWeek = Math.floor(daysBetween(ROLLING_EPOCH, firstMonday) / 7);
  return Array.from({ length: weeks }, (_, i) => {
    const w = epochWeek + i;
    const block = Math.floor(w / cycleWeeks);
    return {
      phase: (block % 3 === 0 ? 'base' : 'build') as Phase,
      recovery: w % cycleWeeks === cycleWeeks - 1,
    };
  });
}

function pickAGoal(goals: readonly Goal[], today: IsoDate): Goal | null {
  return (
    goals
      .filter((g) => g.priority === 'A' && g.kind !== 'specialty' && g.date && g.date >= today)
      .sort((a, b) => (a.date! < b.date! ? -1 : 1))[0] ?? null
  );
}

export function planSeason(input: MacroInput): SeasonPlan {
  const { today, goals, currentCtl, template, overrides, blocked = [], settings } = input;
  const warnings: string[] = [];
  const firstMonday = startOfWeek(today);
  const aGoal = pickAGoal(goals, today);

  let phases: Phase[];
  let recovery: boolean[];
  let specialty: Specialty;

  if (aGoal) {
    const weeks = Math.floor(daysBetween(firstMonday, startOfWeek(aGoal.date!)) / 7) + 1;
    phases = allocatePhases(weeks);
    recovery = markRecovery(phases, settings.cycleWeeks);
    specialty = aGoal.specialty;
    if (weeks <= 3) warnings.push(`Only ${weeks} week${weeks > 1 ? 's' : ''} to ${aGoal.name}: the plan is mostly taper.`);
  } else {
    const rolling = rollingPhases(firstMonday, ROLLING_WEEKS, settings.cycleWeeks);
    phases = rolling.map((r) => r.phase);
    recovery = rolling.map((r) => r.recovery);
    specialty = goals.find((g) => g.kind === 'specialty')?.specialty ?? 'allround';
  }

  const minutes = weeklyMinutes(firstMonday, phases.length, template, overrides, blocked);
  if (templateMinutes(template) === 0) warnings.push('No weekly availability set: add your available time per day.');

  // Ramp: experience default, or what a CTL target needs (never above the experience cap).
  let ramp = RAMP_PER_WEEK[settings.experience];
  if (aGoal?.target?.metric === 'ctl') {
    const loadingWeeks = phases.filter((p, i) => (p === 'base' || p === 'build') && !recovery[i]).length;
    const needed = loadingWeeks > 0 ? (aGoal.target.value - currentCtl) / loadingWeeks : Infinity;
    if (needed > ramp) {
      warnings.push(
        `CTL ${aGoal.target.value} by ${aGoal.date} needs +${needed.toFixed(1)} CTL/week; the safe ramp for your experience is +${ramp}.`,
      );
    } else {
      ramp = Math.max(0, needed);
    }
  }

  const eventsByWeek = new Map<IsoDate, WeekEvent[]>();
  for (const g of goals) {
    if (!g.date || g.date < firstMonday || g.kind === 'specialty') continue;
    const wk = startOfWeek(g.date);
    eventsByWeek.set(wk, [...(eventsByWeek.get(wk) ?? []), { goalId: g.id, name: g.name, date: g.date, priority: g.priority }]);
  }

  let ctl = currentCtl;
  let reference = weeklyLoadFor(ctl, ctl); // "normal" week = maintenance at first
  let peakIdx = 0;
  const weeks: PlanWeek[] = phases.map((phase, index) => {
    const start = addDays(firstMonday, index * 7);
    const cap = (minutes[index]! / 60) * TSS_PER_HOUR * USABLE_FRACTION;
    const events = eventsByWeek.get(start) ?? [];
    const isRecovery = recovery[index]!;

    let wanted: number;
    if ((phase === 'base' || phase === 'build') && !isRecovery) {
      const r = phase === 'base' ? ramp * BASE_RAMP_FACTOR : ramp;
      wanted = weeklyLoadFor(ctl, ctl + r);
    } else if (isRecovery) {
      wanted = reference * RECOVERY_WEEK_LOAD;
    } else if (phase === 'peak') {
      wanted = reference * PEAK_WEEK_LOADS[Math.min(peakIdx++, PEAK_WEEK_LOADS.length - 1)]!;
    } else {
      wanted = reference * RACE_WEEK_LOAD;
    }
    if (phase !== 'race' && events.some((e) => e.priority === 'B')) wanted = Math.min(wanted, reference * B_EVENT_WEEK_LOAD);

    const targetTss = Math.round(Math.min(wanted, cap));
    const timeLimited = wanted > cap + 0.5;
    if ((phase === 'base' || phase === 'build') && !isRecovery) reference = targetTss;
    ctl = ctlAfterWeek(ctl, targetTss);

    return { index, start, phase, recovery: isRecovery, availableMinutes: minutes[index]!, targetTss, targetCtl: ctl, timeLimited, events };
  });

  const limited = weeks.filter((w) => w.timeLimited && (w.phase === 'base' || w.phase === 'build') && !w.recovery).length;
  if (limited >= 3) {
    warnings.push(`Available time limits the ramp in ${limited} weeks: more hours (or fewer days off) would allow more fitness.`);
  }

  return {
    mode: aGoal ? 'event' : 'rolling',
    goal: aGoal,
    specialty,
    startCtl: currentCtl,
    peakCtl: Math.max(currentCtl, ...weeks.map((w) => w.targetCtl)),
    sustainableCtl: sustainableCtl(templateMinutes(template)),
    weeks,
    warnings,
  };
}

import { addDays, dateRange } from '../lib/dates';
import type { ResolvedDay } from './availability';
import { planSeason, type PlanWeek } from './macro';
import { DEFAULT_PLAN_SETTINGS, type AvailabilityTemplate, type RideMode } from './types';
import { isHardActivity, planHorizon, planWeek, type DayPlan, type DoneActivity, type WeekPlanInput } from './week';

const MONDAY = '2026-11-16';
const day = (date: string, minutes: number, mode: RideMode = 'any', extra: Partial<ResolvedDay> = {}): ResolvedDay => ({
  date, minutes, mode, source: 'template', ...extra,
});
// Mon off, Tue 60 indoor, Wed 60, Thu 75 indoor, Fri off, Sat 180 outdoor, Sun 120 outdoor
const WEEK_DAYS = (): ResolvedDay[] => {
  const mins = [0, 60, 60, 75, 0, 180, 120];
  const modes: RideMode[] = ['any', 'indoor', 'any', 'indoor', 'any', 'outdoor', 'outdoor'];
  return dateRange(MONDAY, 7).map((d, i) => day(d, mins[i]!, modes[i]));
};

function week(over: Partial<PlanWeek> = {}): PlanWeek {
  return { index: 4, start: MONDAY, phase: 'build', recovery: false, availableMinutes: 495, targetTss: 420, targetCtl: 55, timeLimited: false, events: [], ...over };
}

function plan(over: Partial<WeekPlanInput> = {}): DayPlan[] {
  return planWeek({ week: week(), days: WEEK_DAYS(), today: addDays(MONDAY, -1), specialty: 'allround', experience: 'intermediate', done: [], weeksIntoPhase: 2, ...over });
}

const hardDays = (p: DayPlan[]) => p.filter((d) => d.workout?.intensity === 'hard').map((d) => d.date);
const totalTss = (p: DayPlan[]) => p.reduce((s, d) => s + (d.workout?.tss ?? 0), 0);

describe('planWeek', () => {
  it('never schedules hard days back to back', () => {
    for (const phase of ['base', 'build', 'peak'] as const) {
      const p = plan({ week: week({ phase }) });
      const hard = hardDays(p);
      for (const d of hard) expect(hard).not.toContain(addDays(d, 1));
    }
  });

  it('puts the long ride on the longest outdoor day and intervals indoors', () => {
    const p = plan({ week: week({ phase: 'base' }) });
    const sat = p.find((d) => d.date === addDays(MONDAY, 5))!;
    expect(sat.workout?.type).toBe('long');
    expect(sat.workout?.outdoor).toBeDefined();
    for (const d of p.filter((x) => x.mode === 'outdoor')) {
      expect(['long', 'endurance', 'recovery', 'tempo', 'openers', undefined]).toContain(d.workout?.type);
    }
  });

  it('places build key sessions and gets close to the weekly load', () => {
    const p = plan();
    expect(p.filter((d) => d.key).length).toBeGreaterThanOrEqual(2);
    expect(totalTss(p)).toBeGreaterThan(420 * 0.8);
    expect(totalTss(p)).toBeLessThan(420 * 1.2);
    expect(p.every((d) => d.reason.length > 0)).toBe(true);
  });

  it('keeps days without time as rest and explains holidays', () => {
    const days = WEEK_DAYS();
    days[2] = day(days[2]!.date, 0, 'any', { source: 'blocked', note: 'Ski trip' });
    const p = plan({ days });
    expect(p[0]!.kind).toBe('rest');
    expect(p[2]!.reason).toMatch(/Ski trip/);
  });

  it('runs a recovery week with one short key session at a lower level', () => {
    const normal = plan();
    const rec = plan({ week: week({ recovery: true, targetTss: 250 }) });
    const keys = rec.filter((d) => d.key);
    expect(keys).toHaveLength(1);
    expect(keys[0]!.workout!.seconds).toBeLessThanOrEqual(60 * 60);
    expect(keys[0]!.workout!.level).toBeLessThan(normal.find((d) => d.key && d.workout?.type !== 'long')!.workout!.level);
    expect(totalTss(rec)).toBeLessThan(totalTss(normal));
  });

  it('does not schedule intensity the day after a hard activity (incl. other sports)', () => {
    const tuesday = addDays(MONDAY, 1);
    const done: DoneActivity[] = [{ date: MONDAY, name: 'Hard run', load: 90, hard: true, cycling: false }];
    const p = plan({ done, today: tuesday, days: WEEK_DAYS().slice(1) });
    expect(p[0]!.workout?.intensity).not.toBe('hard');
    // and the run's load counts toward the week
    expect(totalTss(p)).toBeLessThan(totalTss(plan()) + 1);
  });

  it('marks today as done when already trained, and counts the load', () => {
    const tuesday = addDays(MONDAY, 1);
    const p = plan({ today: tuesday, days: WEEK_DAYS().slice(1), done: [{ date: tuesday, name: 'Zwift race', load: 80, hard: true, cycling: true }] });
    expect(p[0]!.kind).toBe('done');
    expect(p[0]!.tentative).toBe(false);
    expect(p[1]!.tentative).toBe(true);
    expect(p[1]!.workout?.intensity).not.toBe('hard'); // day after a hard ride
  });

  it('keeps the ride on after another sport today, but not a hard one after a hard run', () => {
    const tuesday = addDays(MONDAY, 1);
    const easyRun = plan({ today: tuesday, days: WEEK_DAYS().slice(1), done: [{ date: tuesday, name: 'Easy run', load: 30, hard: false, cycling: false }] });
    expect(easyRun[0]!.kind).toBe('workout');
    const hardRun = plan({ today: tuesday, days: WEEK_DAYS().slice(1), done: [{ date: tuesday, name: 'Intervals run', load: 90, hard: true, cycling: false }] });
    expect(hardRun[0]!.kind).toBe('workout');
    expect(hardRun[0]!.workout?.intensity).not.toBe('hard');
  });

  it('sets up race week: openers the day before, event on the day', () => {
    const sun = addDays(MONDAY, 6);
    const p = plan({ week: week({ phase: 'race', targetTss: 200, events: [{ goalId: 'g', name: 'Big race', date: sun, priority: 'A' }] }) });
    expect(p[6]!.kind).toBe('event');
    expect(p[5]!.workout?.type).toBe('openers');
    expect(p.filter((d) => d.key && d.kind === 'workout')).toHaveLength(0);
  });

  it('keeps at least one rest day when every day has time', () => {
    const days = dateRange(MONDAY, 7).map((d) => day(d, 90));
    expect(plan({ days, week: week({ targetTss: 700 }) }).some((d) => d.kind === 'rest')).toBe(true);
  });
});

describe('isHardActivity', () => {
  it('uses IF for rides and load/RPE for other sports', () => {
    expect(isHardActivity({ cycling: true, intensity: 88, load: 70 })).toBe(true);
    expect(isHardActivity({ cycling: true, intensity: 70, load: 150 })).toBe(false);
    expect(isHardActivity({ cycling: false, load: 75 })).toBe(true);
    expect(isHardActivity({ cycling: false, load: 30, rpe: 8 })).toBe(true);
    expect(isHardActivity({ cycling: false, load: 30 })).toBe(false);
  });
});

describe('planHorizon', () => {
  const template: AvailabilityTemplate = [day('', 0), day('', 60, 'indoor'), day('', 60), day('', 60, 'indoor'), day('', 0), day('', 180, 'outdoor'), day('', 120, 'outdoor')];
  const today = '2026-11-18'; // Wednesday
  const season = planSeason({
    today, currentCtl: 50, template, overrides: [], settings: DEFAULT_PLAN_SETTINGS,
    goals: [{ id: 'a', kind: 'event', name: 'Race', date: '2027-04-18', priority: 'A', specialty: 'climbing', source: 'local' }],
  });
  const days = dateRange(today, 14).map((d, i) => ({ ...template[(i + 2) % 7]!, date: d, source: 'template' as const }));

  it('plans 14 days across three plan weeks, only today committed', () => {
    const p = planHorizon({ today, plan: season, days, done: [], experience: 'intermediate' });
    expect(p).toHaveLength(14);
    expect(p[0]!.date).toBe(today);
    expect(p[0]!.tentative).toBe(false);
    expect(p.slice(1).every((d) => d.tentative)).toBe(true);
    const hard = p.filter((d) => d.workout?.intensity === 'hard').map((d) => d.date);
    for (const d of hard) expect(hard).not.toContain(addDays(d, 1));
  });

  it('is deterministic', () => {
    const a = planHorizon({ today, plan: season, days, done: [], experience: 'intermediate' });
    const b = planHorizon({ today, plan: season, days, done: [], experience: 'intermediate' });
    expect(a).toEqual(b);
  });
});

describe('load fitting', () => {
  it('rides upper Z2 rather than missing a load target the time allows', () => {
    const p = plan({ week: week({ phase: 'base', targetTss: 470 }) });
    const endurance = p.filter((d) => d.workout?.type === 'endurance');
    expect(endurance.some((d) => d.workout!.intensityFactor > 0.68)).toBe(true);
    expect(endurance.every((d) => d.workout!.intensityFactor <= 0.75)).toBe(true);
    expect(totalTss(p)).toBeGreaterThan(470 * 0.9);
  });
});

describe('fixed workouts from intervals.icu', () => {
  it('keeps the user’s own workout, counts its load and avoids intensity next to a hard one', () => {
    const thu = addDays(MONDAY, 3);
    const p = plan({ fixed: [{ date: thu, name: 'Club chaingang', load: 110, hard: true }] });
    const day = p.find((d) => d.date === thu)!;
    expect(day.kind).toBe('fixed');
    expect(day.reason).toMatch(/Club chaingang/);
    const wed = p.find((d) => d.date === addDays(MONDAY, 2))!;
    expect(wed.workout?.intensity).not.toBe('hard');
    expect(totalTss(p) + 110).toBeLessThan(420 * 1.2);
    // The chaingang counts as one of the build week's interval key sessions.
    const intervalKeys = (q: DayPlan[]) => q.filter((d) => d.key && d.kind === 'workout' && d.workout?.type !== 'long').length;
    expect(intervalKeys(p)).toBe(intervalKeys(plan()) - 1);
  });
});

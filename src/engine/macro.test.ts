import { addDays } from '../lib/dates';
import {
  allocatePhases, ctlAfterWeek, markRecovery, planSeason, TSS_PER_HOUR, USABLE_FRACTION, weeklyLoadFor, type MacroInput,
} from './macro';
import { DEFAULT_PLAN_SETTINGS, type AvailabilityTemplate, type Goal } from './types';
import { phaseFocus } from './focus';

const TODAY = '2026-11-10'; // Tuesday
const day = (minutes: number) => ({ minutes, mode: 'any' as const });
const TEMPLATE: AvailabilityTemplate = [day(0), day(60), day(60), day(60), day(0), day(180), day(120)]; // 8 h

function event(date: string, priority: Goal['priority'] = 'A', extra: Partial<Goal> = {}): Goal {
  return { id: `g-${date}`, kind: 'event', name: `Race ${date}`, date, priority, specialty: 'climbing', source: 'local', ...extra };
}

function input(over: Partial<MacroInput> = {}): MacroInput {
  return { today: TODAY, goals: [], currentCtl: 40, template: TEMPLATE, overrides: [], settings: DEFAULT_PLAN_SETTINGS, ...over };
}

describe('load maths', () => {
  it('weeklyLoadFor and ctlAfterWeek are inverses', () => {
    const tss = weeklyLoadFor(50, 55);
    expect(ctlAfterWeek(50, tss)).toBeCloseTo(55);
    expect(weeklyLoadFor(50, 50)).toBeCloseTo(350); // maintenance = 7 × CTL
  });
});

describe('allocatePhases', () => {
  it('builds a full Friel-style season for 23 weeks', () => {
    const p = allocatePhases(23);
    expect(p.filter((x) => x === 'base')).toHaveLength(12);
    expect(p.filter((x) => x === 'build')).toHaveLength(8);
    expect(p.slice(-3)).toEqual(['peak', 'peak', 'race']);
  });

  it('compresses short timelines', () => {
    expect(allocatePhases(1)).toEqual(['race']);
    expect(allocatePhases(3)).toEqual(['peak', 'peak', 'race']);
    expect(allocatePhases(6)).toEqual(['build', 'build', 'build', 'peak', 'peak', 'race']);
    expect(allocatePhases(12).filter((x) => x === 'base').length).toBeGreaterThan(0);
  });

  it('places recovery weeks counting back from the end of build', () => {
    const phases = allocatePhases(12); // base 4, build 5, peak 2, race 1
    const rec = markRecovery(phases, 4);
    const lastLoad = phases.lastIndexOf('build');
    expect(rec[lastLoad]).toBe(false);
    expect(rec[lastLoad - 3]).toBe(true);
    expect(rec.filter(Boolean)).toHaveLength(2);
    expect(markRecovery(phases, 3).filter(Boolean)).toHaveLength(2); // week 0 would be the third
  });

  it('never starts the plan with a recovery week', () => {
    // base 4 + build 5: counting back in 2:1 cycles lands exactly on week 0
    const rec = markRecovery(allocatePhases(12), 3);
    expect(rec[0]).toBe(false);
    expect(rec[3]).toBe(true);
  });
});

describe('planSeason', () => {
  it('plans up to the A event and peaks fitness before tapering', () => {
    const plan = planSeason(input({ goals: [event('2027-04-18')] }));
    expect(plan.mode).toBe('event');
    expect(plan.weeks[0]!.start).toBe('2026-11-09');
    expect(plan.weeks.at(-1)!.phase).toBe('race');
    expect(plan.weeks.at(-1)!.events[0]!.name).toBe('Race 2027-04-18');
    expect(plan.peakCtl).toBeGreaterThan(55);
    // Form rises into the race: load drops in peak and race weeks
    const build = plan.weeks.filter((w) => w.phase === 'build' && !w.recovery).at(-1)!;
    expect(plan.weeks.at(-1)!.targetTss).toBeLessThan(build.targetTss * 0.6);
    expect(plan.specialty).toBe('climbing');
  });

  it('never ramps faster than the experience cap', () => {
    const plan = planSeason(input({ goals: [event('2027-04-18')], template: [day(600), day(600), day(600), day(600), day(600), day(600), day(600)] }));
    let prev = 40;
    for (const w of plan.weeks) {
      expect(w.targetCtl - prev).toBeLessThanOrEqual(5.05); // TSS is rounded to whole numbers
      prev = w.targetCtl;
    }
  });

  it('caps load by available time and warns', () => {
    const plan = planSeason(input({ goals: [event('2027-04-18')], currentCtl: 70, template: [day(0), day(45), day(0), day(45), day(0), day(60), day(0)] }));
    expect(plan.weeks.every((w) => w.targetTss <= (w.availableMinutes / 60) * TSS_PER_HOUR * USABLE_FRACTION + 1)).toBe(true);
    expect(plan.warnings.join(' ')).toMatch(/Available time limits/);
    expect(plan.peakCtl).toBe(70); // CTL can only fall from here
  });

  it('a holiday week (no time) drops load to zero', () => {
    const holidayStart = '2026-12-21';
    const overrides = Array.from({ length: 7 }, (_, i) => ({ date: addDays(holidayStart, i), minutes: 0, mode: 'any' as const }));
    const plan = planSeason(input({ goals: [event('2027-04-18')], overrides }));
    const w = plan.weeks.find((x) => x.start === holidayStart)!;
    expect(w.targetTss).toBe(0);
    expect(w.targetCtl).toBeLessThan(plan.weeks[w.index - 1]!.targetCtl);
  });

  it('gives B events a mini-taper and leaves C events alone', () => {
    const base = planSeason(input({ goals: [event('2027-04-18')] }));
    const withB = planSeason(input({ goals: [event('2027-04-18'), event('2027-02-14', 'B'), event('2027-03-07', 'C')] }));
    const bWeek = withB.weeks.find((w) => w.events.some((e) => e.priority === 'B'))!;
    const cWeek = withB.weeks.find((w) => w.events.some((e) => e.priority === 'C'))!;
    expect(bWeek.targetTss).toBeLessThan(base.weeks[bWeek.index]!.targetTss);
    expect(cWeek.targetTss).toBe(base.weeks[cWeek.index]!.targetTss);
  });

  it('rolls 16-week blocks for a specialty goal, stable from day to day', () => {
    const goals: Goal[] = [{ id: 's', kind: 'specialty', name: 'Climb better', priority: 'A', specialty: 'climbing', source: 'local' }];
    const a = planSeason(input({ goals }));
    const b = planSeason(input({ goals, today: addDays(TODAY, 3) })); // same week
    expect(a.mode).toBe('rolling');
    expect(a.weeks).toHaveLength(16);
    expect(a.weeks.map((w) => [w.phase, w.recovery])).toEqual(b.weeks.map((w) => [w.phase, w.recovery]));
    expect(a.weeks.filter((w) => w.recovery)).toHaveLength(4);
    expect(a.specialty).toBe('climbing');
  });

  it('warns when a CTL target is out of safe reach, and eases off when it is easy', () => {
    const hard = planSeason(input({ goals: [event('2027-01-31', 'A', { kind: 'target', target: { metric: 'ctl', value: 120 } })] }));
    expect(hard.warnings.join(' ')).toMatch(/CTL 120/);
    const easy = planSeason(input({ goals: [event('2027-04-18', 'A', { kind: 'target', target: { metric: 'ctl', value: 50 } })] }));
    expect(easy.warnings).toHaveLength(0);
    expect(easy.peakCtl).toBeLessThan(55);
  });

  it('ignores past goals and warns about missing availability', () => {
    const plan = planSeason(input({ goals: [event('2026-10-01')], template: [day(0), day(0), day(0), day(0), day(0), day(0), day(0)] }));
    expect(plan.mode).toBe('rolling');
    expect(plan.warnings.join(' ')).toMatch(/No weekly availability/);
  });
});

describe('phaseFocus', () => {
  it('tweaks key sessions by specialty', () => {
    expect(phaseFocus('build', 'sprint').keySessions[0]).toBe('vo2');
    expect(phaseFocus('build', 'allround').keySessions[0]).toBe('threshold');
    expect(phaseFocus('race', 'climbing').keySessions[0]).toBe('openers');
  });
});

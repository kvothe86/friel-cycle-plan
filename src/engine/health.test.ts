import { addDays, dateRange } from '../lib/dates';
import { computeLevels, type PlanLogEntry } from './progression';
import { healthStatus, levelPenalty, sickDays, type SicknessEpisode } from './sickness';

const TODAY = '2026-11-20';
const ep = (over: Partial<SicknessEpisode>): SicknessEpisode => ({ id: 's', start: '2026-11-15', severity: 'mild', source: 'local', ...over });

describe('sickness stages', () => {
  it('mild: sick days, then 2 re-entry and 2 reload days', () => {
    const e = ep({ start: '2026-11-15', end: '2026-11-17' });
    const stages = dateRange('2026-11-15', 9).map((d) => healthStatus(d, [e], TODAY)?.stage ?? null);
    expect(stages).toEqual(['sick', 'sick', 'sick', 'reentry', 'reentry', 'reload', 'reload', null, null]);
  });

  it('severe: 2 symptom-free rest days, re-entry as long as the illness (3–7)', () => {
    const e = ep({ start: '2026-11-10', end: '2026-11-14', severity: 'severe' }); // 5 sick days
    const after = dateRange('2026-11-15', 13).map((d) => healthStatus(d, [e], TODAY)?.stage ?? null);
    expect(after).toEqual([
      'symptom-free', 'symptom-free',
      'reentry', 'reentry', 'reentry', 'reentry', 'reentry',
      'reload', 'reload', 'reload', 'reload', 'reload', null,
    ]);
  });

  it('injury uses the mild flow even when marked severe', () => {
    const e = ep({ start: '2026-11-15', end: '2026-11-16', severity: 'severe', kind: 'injury' });
    expect(healthStatus('2026-11-17', [e], TODAY)?.stage).toBe('reentry');
  });

  it('still sick: at least 3 days, and never ends before today', () => {
    expect(sickDays(ep({ start: TODAY }), TODAY)).toBe(3);
    expect(healthStatus(addDays(TODAY, 2), [ep({ start: TODAY })], TODAY)?.stage).toBe('sick');
    expect(healthStatus(addDays(TODAY, 3), [ep({ start: TODAY })], TODAY)?.stage).toBe('reentry');
    expect(sickDays(ep({ start: '2026-11-10' }), TODAY)).toBe(11);
  });

  it('penalises levels after illness and fades after 4 weeks', () => {
    expect(levelPenalty([ep({ start: '2026-11-15', end: '2026-11-17' })], TODAY)).toBe(1.5);
    expect(levelPenalty([ep({ start: '2026-11-10', end: '2026-11-17', severity: 'severe' })], TODAY)).toBe(3);
    expect(levelPenalty([ep({ start: '2026-09-01', end: '2026-09-05' })], TODAY)).toBe(0);
  });
});

describe('computeLevels', () => {
  const log = (date: string, type: PlanLogEntry['type'], level: number, tss = 80, seconds = 3600): PlanLogEntry => ({ date, type, level, tss, seconds, key: true });

  it('starts at the experience level', () => {
    expect(computeLevels('intermediate', [], [], TODAY).threshold).toBe(4);
  });

  it('goes up after completed sessions, down after failed ones; skipped days do nothing', () => {
    const entries = [log('2026-11-10', 'threshold', 4), log('2026-11-12', 'threshold', 4.3), log('2026-11-14', 'vo2', 4), log('2026-11-16', 'sweetspot', 4)];
    const rides = [
      { date: '2026-11-10', load: 82, seconds: 3600 },
      { date: '2026-11-12', load: 78, seconds: 3500 },
      { date: '2026-11-14', load: 35, seconds: 1800 }, // partial
      // 16th skipped
    ];
    const l = computeLevels('intermediate', entries, rides, TODAY);
    expect(l.threshold).toBe(4.6);
    expect(l.vo2).toBe(3.7);
    expect(l.sweetspot).toBe(4);
  });

  it('decays after three weeks without a session of that system', () => {
    const l = computeLevels('intermediate', [log('2026-10-01', 'vo2', 4)], [{ date: '2026-10-01', load: 80, seconds: 3600 }], TODAY);
    expect(l.vo2).toBeLessThan(4.3);
  });

  it('applies the illness penalty to every system', () => {
    const l = computeLevels('intermediate', [], [], TODAY, [ep({ start: '2026-11-15', end: '2026-11-17' })]);
    expect(l.threshold).toBe(2.5);
    expect(l.endurance).toBe(2.5);
  });
});

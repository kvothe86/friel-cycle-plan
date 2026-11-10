import { addDays, dateRange } from '../lib/dates';
import type { IcuWellness } from '../integrations/intervals/types';
import { computeReadiness, hrvZ, labelFor, rhrDelta } from './readiness';

const TODAY = '2026-11-10';

/** 60 days of stable baseline with a little alternating noise. */
function baseline(overrides: Record<string, Partial<IcuWellness>> = {}): IcuWellness[] {
  return dateRange(addDays(TODAY, -60), 61).map((id, i) => ({
    id,
    hrv: i % 2 ? 62 : 58,
    restingHR: i % 2 ? 49 : 51,
    ...overrides[id],
  }));
}

describe('readiness', () => {
  it('maps scores to labels', () => {
    expect(labelFor(20)).toBe('low');
    expect(labelFor(50)).toBe('reduced');
    expect(labelFor(70)).toBe('normal');
    expect(labelFor(90)).toBe('high');
  });

  it('is null with no data at all', () => {
    const r = computeReadiness([], TODAY);
    expect(r.score).toBeNull();
    expect(r.missing).toHaveLength(5);
  });

  it('needs a baseline before using HRV/RHR', () => {
    const short = baseline().slice(-5);
    expect(hrvZ(new Map(short.map((w) => [w.id, w])), TODAY)).toBeNull();
    expect(computeReadiness(short, TODAY).missing).toEqual(expect.arrayContaining(['hrv', 'rhr']));
  });

  it('scores a normal day as normal', () => {
    const r = computeReadiness(baseline(), TODAY, 0);
    expect(r.label).toBe('normal');
    expect(r.sickSuspected).toBe(false);
  });

  it('drops sharply with crashed HRV, high RHR, bad sleep and deep fatigue', () => {
    const r = computeReadiness(
      baseline({ [TODAY]: { hrv: 35, restingHR: 60, sleepSecs: 4.5 * 3600, fatigue: 4, soreness: 4 } }),
      TODAY,
      -30,
    );
    expect(r.score).toBeLessThan(40);
    expect(r.label).toBe('low');
  });

  it('renormalises weights when signals are missing', () => {
    const onlyForm = computeReadiness([], TODAY, 10);
    expect(onlyForm.score).toBe(100);
    expect(onlyForm.signals.map((s) => s.key)).toEqual(['form']);
  });

  it('suspects sickness only after two consecutive bad days', () => {
    const y = addDays(TODAY, -1);
    const bad = { hrv: 38, restingHR: 58 };
    expect(computeReadiness(baseline({ [TODAY]: bad }), TODAY).sickSuspected).toBe(false);
    const both = baseline({ [TODAY]: bad, [y]: bad });
    expect(rhrDelta(new Map(both.map((w) => [w.id, w])), TODAY)).toBeGreaterThan(5);
    expect(computeReadiness(both, TODAY).sickSuspected).toBe(true);
  });
});

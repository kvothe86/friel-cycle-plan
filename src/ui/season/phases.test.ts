import { dateRange } from '../../lib/dates';
import { planSeason } from '../../engine/macro';
import { DEFAULT_AVAILABILITY, DEFAULT_PLAN_SETTINGS } from '../../engine/types';
import { dailyTargetCtl, eventMarkers, phaseBands } from './phases';

const plan = planSeason({
  today: '2026-11-11',
  goals: [{ id: 'a', kind: 'event', name: 'Race', date: '2027-03-14', priority: 'A', specialty: 'allround', source: 'local' }],
  currentCtl: 45,
  template: DEFAULT_AVAILABILITY,
  overrides: [],
  settings: DEFAULT_PLAN_SETTINGS,
});

describe('season chart helpers', () => {
  it('interpolates target CTL from today to the end of the plan', () => {
    const t = dailyTargetCtl(plan, '2026-11-11');
    expect(t.get('2026-11-11')).toBeCloseTo(45);
    expect(t.has('2026-11-10')).toBe(false);
    expect(t.get('2026-11-16')).toBeCloseTo(plan.weeks[0]!.targetCtl);
  });

  it('merges phases into bands and marks the race', () => {
    const dates = dateRange('2026-09-01', 220);
    const labels = phaseBands(plan, dates).map((b) => b.label).filter(Boolean);
    expect(labels).toEqual(expect.arrayContaining(['Base', 'Build', 'Peak', 'Race']));
    expect(eventMarkers(plan, dates)).toEqual([expect.objectContaining({ label: 'A: Race', index: dates.indexOf('2027-03-14') })]);
  });
});

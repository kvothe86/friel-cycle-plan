import { dayStatuses } from './adjust';

const TODAY = '2026-11-20';
const dates = ['2026-11-20', '2026-11-21', '2026-11-22', '2026-11-23', '2026-11-24'];

describe('dayStatuses', () => {
  it('maps sickness stages, actions and readiness with the right precedence', () => {
    const st = dayStatuses({
      today: TODAY,
      dates,
      episodes: [{ id: 'e', start: '2026-11-19', end: '2026-11-21', severity: 'mild', source: 'local' }],
      actions: [{ date: '2026-11-20', action: 'easier' }, { date: '2026-11-24', action: 'skip' }],
      readiness: { score: 30, label: 'low' },
    });
    expect(st.get('2026-11-20')).toMatchObject({ kind: 'rest', reason: expect.stringMatching(/Sick \(day 2\)/) }); // sickness beats action + readiness
    expect(st.get('2026-11-22')).toMatchObject({ kind: 'limit', limit: 'reentry' });
    expect(st.get('2026-11-24')).toMatchObject({ kind: 'rest', reason: expect.stringMatching(/Skipped/) });
  });

  it('applies readiness to today only', () => {
    const st = dayStatuses({ today: TODAY, dates, episodes: [], actions: [], readiness: { score: 50, label: 'reduced' } });
    expect(st.get(TODAY)).toMatchObject({ limit: 'no-hard' });
    expect(st.size).toBe(1);
    expect(dayStatuses({ today: TODAY, dates, episodes: [], actions: [], readiness: { score: 75, label: 'normal' } }).size).toBe(0);
  });
});

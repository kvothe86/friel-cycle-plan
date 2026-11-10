import { buildPmcSeries, dailyLoads, stepPmc } from './pmc';

describe('pmc', () => {
  it('sums load per day across sports and ignores empty loads', () => {
    const loads = dailyLoads([
      { date: '2026-11-01', icu_training_load: 50 },
      { date: '2026-11-01', icu_training_load: 30 }, // run, same day
      { date: '2026-11-02', icu_training_load: null },
    ]);
    expect(loads.get('2026-11-01')).toBe(80);
    expect(loads.has('2026-11-02')).toBe(false);
  });

  it('steps CTL and ATL with 42/7-day constants', () => {
    const next = stepPmc({ ctl: 42, atl: 7 }, 84);
    expect(next.ctl).toBeCloseTo(43);
    expect(next.atl).toBeCloseTo(18);
  });

  it('converges towards a constant daily load', () => {
    const loads = new Map<string, number>();
    const series = buildPmcSeries([], loads, '2026-01-01', '2026-12-31', { ctl: 100, atl: 100 });
    // no load at all: both decay, ATL faster than CTL → positive form
    const last = series.at(-1)!;
    expect(last.ctl).toBeLessThan(5);
    expect(last.tsb).toBeGreaterThan(0);
  });

  it('prefers intervals.icu values and fills gaps from them', () => {
    const series = buildPmcSeries(
      [
        { id: '2026-11-01', ctl: 60, atl: 70 },
        { id: '2026-11-03', ctl: 61, atl: 75 },
      ],
      new Map([['2026-11-02', 100]]),
      '2026-11-01',
      '2026-11-03',
    );
    expect(series.map((p) => p.source)).toEqual(['intervals', 'computed', 'intervals']);
    expect(series[1]!.ctl).toBeCloseTo(60 + 40 / 42);
    expect(series[1]!.atl).toBeCloseTo(70 + 30 / 7);
    expect(series[2]!.tsb).toBe(-14);
  });
});

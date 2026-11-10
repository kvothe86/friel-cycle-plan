import { addDays, dateRange, daysBetween, parseIsoDate, toIsoDate } from './dates';

describe('dates', () => {
  it('round-trips ISO dates', () => {
    expect(toIsoDate(parseIsoDate('2026-11-10'))).toBe('2026-11-10');
  });

  it('rejects invalid dates', () => {
    expect(() => parseIsoDate('2026-02-30')).toThrow();
    expect(() => parseIsoDate('10-11-2026')).toThrow();
  });

  it('adds days across month, year and DST boundaries', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-28', 2)).toBe('2026-03-30'); // EU DST start
    expect(addDays('2026-10-24', 2)).toBe('2026-10-26'); // EU DST end
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });

  it('builds a 14-day window', () => {
    const range = dateRange('2026-11-10', 14);
    expect(range).toHaveLength(14);
    expect(range[0]).toBe('2026-11-10');
    expect(range[13]).toBe('2026-11-23');
  });

  it('counts days between dates', () => {
    expect(daysBetween('2026-11-10', '2026-11-23')).toBe(13);
    expect(daysBetween('2026-03-01', '2026-04-01')).toBe(31);
    expect(daysBetween('2026-11-23', '2026-11-10')).toBe(-13);
  });
});

describe('weeks', () => {
  it('uses Monday as the first day of the week', async () => {
    const { startOfWeek, weekdayIndex } = await import('./dates');
    expect(weekdayIndex('2026-11-09')).toBe(0); // Monday
    expect(weekdayIndex('2026-11-15')).toBe(6); // Sunday
    expect(startOfWeek('2026-11-15')).toBe('2026-11-09');
    expect(startOfWeek('2026-11-09')).toBe('2026-11-09');
    expect(startOfWeek('2027-01-01')).toBe('2026-12-28');
  });
});

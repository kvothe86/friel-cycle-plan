import { holidayRanges } from './hooks';
import type { StoredEvent } from './db';

const ev = (e: Partial<StoredEvent>): StoredEvent => ({ id: 1, category: 'HOLIDAY', start_date_local: '', date: '2026-12-21', ...e });

describe('holidayRanges', () => {
  it('treats a midnight end as exclusive', () => {
    expect(holidayRanges([ev({ end_date_local: '2026-12-28T00:00:00', name: 'Ski' })])).toEqual([
      { start: '2026-12-21', end: '2026-12-27', reason: 'Ski' },
    ]);
  });
  it('keeps a same-day or timed end inclusive and ignores other categories', () => {
    expect(holidayRanges([ev({ end_date_local: '2026-12-21T00:00:00' }), ev({ id: 2, category: 'SICK' })])).toEqual([
      { start: '2026-12-21', end: '2026-12-21', reason: 'Holiday (intervals.icu)' },
    ]);
    expect(holidayRanges([ev({ end_date_local: '2026-12-23T18:00:00' })])[0]!.end).toBe('2026-12-23');
  });
});

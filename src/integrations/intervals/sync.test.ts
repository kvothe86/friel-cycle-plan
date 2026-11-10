import { CyclingHubDb } from '../../store/db';
import { IntervalsClient } from './client';
import { syncIntervals } from './sync';

function fakeClient(data: { wellness?: unknown[]; activities?: unknown[] }) {
  const calls: string[] = [];
  const f = vi.fn(async (url: string) => {
    calls.push(url);
    const path = new URL(url).pathname;
    const body = path.endsWith('/events')
      ? []
      : path.endsWith('/wellness')
      ? (data.wellness ?? [])
      : path.endsWith('/activities')
        ? (data.activities ?? [])
        : { id: 'i1', name: 'Me' };
    return new Response(JSON.stringify(body), { status: 200 });
  });
  return { client: new IntervalsClient({ athleteId: 'i1', apiKey: 'k' }, f as unknown as typeof fetch), calls };
}

describe('syncIntervals', () => {
  let db: CyclingHubDb;
  beforeEach(() => {
    db = new CyclingHubDb(`test-${Math.random()}`);
  });
  afterEach(async () => {
    await db.delete();
  });

  it('pulls 180 days on first sync and stores everything', async () => {
    const { client, calls } = fakeClient({
      wellness: [{ id: '2026-11-09', ctl: 50, atl: 60 }],
      activities: [{ id: 'a1', start_date_local: '2026-11-09T18:00:00', type: 'Run', icu_training_load: 40 }],
    });
    const res = await syncIntervals(db, client, '2026-11-10');

    expect(res.oldest).toBe('2026-05-14');
    expect(calls.some((u) => u.includes('oldest=2026-05-14'))).toBe(true);
    expect(await db.wellness.get('2026-11-09')).toMatchObject({ ctl: 50 });
    expect(await db.activities.get('a1')).toMatchObject({ date: '2026-11-09', type: 'Run' });
    expect(await db.getMeta('athlete')).toMatchObject({ name: 'Me' });
    expect(await db.getMeta('lastSync')).toMatchObject({ date: '2026-11-10' });
  });

  it('re-fetches a 7-day overlap and removes activities deleted upstream', async () => {
    await db.setMeta('lastSync', { date: '2026-11-08', at: '' });
    await db.activities.bulkPut([
      { id: 'old', date: '2026-10-01', start_date_local: '2026-10-01T10:00:00' },
      { id: 'gone', date: '2026-11-05', start_date_local: '2026-11-05T10:00:00' },
      { id: 'kept', date: '2026-11-06', start_date_local: '2026-11-06T10:00:00' },
    ]);
    const { client } = fakeClient({
      activities: [{ id: 'kept', start_date_local: '2026-11-06T10:00:00', name: 'edited' }],
    });

    const res = await syncIntervals(db, client, '2026-11-10');

    expect(res.oldest).toBe('2026-11-01');
    expect(res.removedActivities).toBe(1);
    expect(await db.activities.get('gone')).toBeUndefined();
    expect(await db.activities.get('old')).toBeDefined();
    expect(await db.activities.get('kept')).toMatchObject({ name: 'edited' });
  });
});

describe('reconcileRaceGoals', () => {
  it('mirrors races, keeps local edits and drops removed races', async () => {
    const { reconcileRaceGoals } = await import('./sync');
    const existing = [
      { id: 'icu-1', kind: 'event', name: 'Old', date: '2027-04-18', priority: 'A', specialty: 'climbing', eventType: 'hill_climb', source: 'intervals', icuEventId: 1 },
      { id: 'icu-9', kind: 'event', name: 'Gone', date: '2027-05-01', priority: 'B', specialty: 'allround', source: 'intervals', icuEventId: 9 },
      { id: 'local-1', kind: 'specialty', name: 'Mine', priority: 'A', specialty: 'tt', source: 'local' },
    ] as const;
    const { put, remove } = reconcileRaceGoals(
      [
        { id: 1, category: 'RACE_A', start_date_local: '2027-04-19T00:00:00', name: 'Renamed' },
        { id: 2, category: 'RACE_C', start_date_local: '2027-03-01T00:00:00', name: 'Club TT' },
        { id: 3, category: 'HOLIDAY', start_date_local: '2026-12-20T00:00:00' },
      ],
      existing.map((g) => ({ ...g })),
    );
    expect(remove).toEqual(['icu-9']);
    expect(put).toHaveLength(2);
    expect(put[0]).toMatchObject({ id: 'icu-1', name: 'Renamed', date: '2027-04-19', specialty: 'climbing', eventType: 'hill_climb' });
    expect(put[1]).toMatchObject({ id: 'icu-2', priority: 'C', specialty: 'allround' });
  });
});

describe('syncIntervals events', () => {
  it('stores events and creates race goals, keeping local goals', async () => {
    const db = new CyclingHubDb(`test-${Math.random()}`);
    await db.goals.put({ id: 'local-1', kind: 'specialty', name: 'Mine', priority: 'A', specialty: 'tt', source: 'local' });
    const f = vi.fn(async (url: string) => {
      const path = new URL(url).pathname;
      const body = path.endsWith('/events')
        ? [{ id: 7, category: 'RACE_A', start_date_local: '2027-04-18T00:00:00', name: 'Big race' }, { id: 8, category: 'HOLIDAY', start_date_local: '2026-12-21T00:00:00', end_date_local: '2026-12-27T00:00:00' }]
        : path.endsWith('/wellness') || path.endsWith('/activities') ? [] : { id: 'i1' };
      return new Response(JSON.stringify(body), { status: 200 });
    });
    const client = new IntervalsClient({ athleteId: 'i1', apiKey: 'k' }, f as unknown as typeof fetch);
    const res = await syncIntervals(db, client, '2026-11-10');
    expect(res.events).toBe(2);
    expect(f.mock.calls.some(([u]) => String(u).includes('/events?oldest=2026-09-11&newest=2027-12-15'))).toBe(true);
    expect(await db.events.where('category').equals('HOLIDAY').count()).toBe(1);
    expect((await db.goals.toArray()).map((g) => g.id).sort()).toEqual(['icu-7', 'local-1']);
    await db.clearSynced();
    expect((await db.goals.toArray()).map((g) => g.id)).toEqual(['local-1']);
    await db.delete();
  });
});

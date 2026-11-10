import { CyclingHubDb } from '../../store/db';
import { IntervalsClient } from './client';
import { syncIntervals } from './sync';

function fakeClient(data: { wellness?: unknown[]; activities?: unknown[] }) {
  const calls: string[] = [];
  const f = vi.fn(async (url: string) => {
    calls.push(url);
    const path = new URL(url).pathname;
    const body = path.endsWith('/wellness')
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

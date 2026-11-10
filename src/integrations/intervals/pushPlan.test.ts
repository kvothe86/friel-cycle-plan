import { buildWorkout } from '../../engine/library';
import type { DayPlan } from '../../engine/week';
import { CyclingHubDb } from '../../store/db';
import { IntervalsClient } from './client';
import { pushPlan } from './pushPlan';
import type { IcuEvent, IcuEventInput } from './types';

const ctx = { level: 4, specialty: 'allround' as const, outdoor: false };
const base = { key: false, reason: 'r', availableMinutes: 90, mode: 'any' as const, tentative: true, phase: 'base' as const, recoveryWeek: false };
const ride = (date: string, minutes: number): DayPlan => ({ ...base, date, kind: 'workout', workout: buildWorkout('endurance', minutes, ctx) });
const rest = (date: string): DayPlan => ({ ...base, date, kind: 'rest' });

/** Minimal stateful stand-in for the intervals.icu events API. */
function fakeIntervals(initial: IcuEvent[] = []) {
  const events = new Map<number, IcuEvent>(initial.map((e) => [e.id, e]));
  let nextId = 100;
  const calls: string[] = [];
  const f = vi.fn(async (url: string, init?: RequestInit) => {
    const u = new URL(url);
    const method = init?.method ?? 'GET';
    calls.push(`${method} ${u.pathname.replace('/api/v1/athlete/i1', '')}`);
    if (method === 'GET' && u.pathname.endsWith('/events')) {
      const oldest = u.searchParams.get('oldest')!;
      const newest = u.searchParams.get('newest')!;
      const list = [...events.values()].filter((e) => e.start_date_local.slice(0, 10) >= oldest && e.start_date_local.slice(0, 10) <= newest);
      return new Response(JSON.stringify(list));
    }
    if (method === 'POST' && u.pathname.endsWith('/events/bulk')) {
      const out = (JSON.parse(init!.body as string) as IcuEventInput[]).map((input) => {
        const prev = [...events.values()].find((e) => e.external_id === input.external_id);
        const stored: IcuEvent = { ...input, id: prev?.id ?? nextId++, description: `${input.description}\n` }; // intervals may reformat
        events.set(stored.id, stored);
        return stored;
      });
      return new Response(JSON.stringify(out));
    }
    if (method === 'DELETE') {
      events.delete(Number(u.pathname.split('/').pop()));
      return new Response(null, { status: 200 });
    }
    return new Response('{}', { status: 404 });
  });
  return { client: new IntervalsClient({ athleteId: 'i1', apiKey: 'k' }, f as unknown as typeof fetch), events, calls };
}

describe('pushPlan', () => {
  let db: CyclingHubDb;
  beforeEach(() => {
    db = new CyclingHubDb(`push-${Math.random()}`);
  });
  afterEach(async () => {
    await db.delete();
  });

  it('creates, then stays idempotent, respects user edits and deletes stale workouts', async () => {
    const own: IcuEvent = { id: 1, category: 'WORKOUT', start_date_local: '2026-11-13T00:00:00', name: 'Club ride' };
    const api = fakeIntervals([own]);

    // 1. First push: two workouts created, the user's own event untouched.
    const first = await pushPlan(db, api.client, [ride('2026-11-12', 60), rest('2026-11-13'), ride('2026-11-14', 90)]);
    expect(first).toMatchObject({ created: 2, updated: 0, deleted: 0 });
    expect(api.events.get(1)).toEqual(own);
    expect(await db.pushed.count()).toBe(2);
    expect(await db.getMeta('lastPush')).toMatchObject({ created: 2 });

    // 2. Same plan again: only the GET, no writes, despite intervals.icu's reformatting.
    api.calls.length = 0;
    const second = await pushPlan(db, api.client, [ride('2026-11-12', 60), rest('2026-11-13'), ride('2026-11-14', 90)]);
    expect(second).toMatchObject({ created: 0, updated: 0, deleted: 0, unchanged: 2 });
    expect(api.calls).toEqual(['GET /events']);

    // 3. The user edits the 12th in intervals.icu; the plan changes both days.
    const e12 = [...api.events.values()].find((e) => e.external_id === 'cyclinghub-2026-11-12')!;
    api.events.set(e12.id, { ...e12, description: 'Changed my mind: 2h easy' });
    const third = await pushPlan(db, api.client, [ride('2026-11-12', 75), rest('2026-11-13'), rest('2026-11-14')]);
    expect(third).toMatchObject({ userEdited: 1, deleted: 1, created: 0, updated: 0 });
    expect(api.events.get(e12.id)!.description).toBe('Changed my mind: 2h easy');
    expect([...api.events.values()].some((e) => e.external_id === 'cyclinghub-2026-11-14')).toBe(false);
    expect(await db.pushed.get('cyclinghub-2026-11-14')).toBeUndefined();
  });
});

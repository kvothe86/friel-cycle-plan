import { addDays, type IsoDate } from '../../lib/dates';
import type { CyclingHubDb, StoredActivity, StoredEvent } from '../../store/db';
import type { Goal, Priority } from '../../engine/types';
import type { IcuEvent } from './types';
import type { IntervalsClient } from './client';

/** History pulled on first connect. 180 days gives a settled CTL and HRV baseline. */
export const INITIAL_HISTORY_DAYS = 180;
/** Days re-fetched on every incremental sync: data is often edited after the fact. */
export const RESYNC_OVERLAP_DAYS = 7;

/** Calendar window for events: recent past (sickness, holidays) up to a season ahead. */
export const EVENTS_PAST_DAYS = 60;
export const EVENTS_FUTURE_DAYS = 400;

const RACE_PRIORITY: Record<string, Priority> = { RACE_A: 'A', RACE_B: 'B', RACE_C: 'C' };

/**
 * Mirrors intervals.icu RACE_A/B/C events as goals. Fields the user edits
 * locally (specialty, event type) survive re-syncs; races removed upstream
 * disappear.
 */
export function reconcileRaceGoals(events: readonly IcuEvent[], existing: readonly Goal[]): { put: Goal[]; remove: string[] } {
  const byId = new Map(existing.filter((g) => g.source === 'intervals').map((g) => [g.id, g]));
  const put: Goal[] = [];
  for (const e of events) {
    const priority = RACE_PRIORITY[e.category];
    if (!priority) continue;
    const id = `icu-${e.id}`;
    const prev = byId.get(id);
    byId.delete(id);
    put.push({
      id,
      kind: 'event',
      name: e.name?.trim() || 'Race',
      date: e.start_date_local.slice(0, 10),
      priority,
      specialty: prev?.specialty ?? 'allround',
      eventType: prev?.eventType ?? 'road_race',
      source: 'intervals',
      icuEventId: e.id,
    });
  }
  return { put, remove: [...byId.keys()] };
}

export interface SyncResult {
  oldest: IsoDate;
  newest: IsoDate;
  wellness: number;
  activities: number;
  removedActivities: number;
  events: number;
}

export async function syncIntervals(
  db: CyclingHubDb,
  client: IntervalsClient,
  today: IsoDate,
  now: Date = new Date(),
): Promise<SyncResult> {
  const lastSync = await db.getMeta('lastSync');
  const oldest = lastSync
    ? addDays(lastSync.date < today ? lastSync.date : today, -RESYNC_OVERLAP_DAYS)
    : addDays(today, -INITIAL_HISTORY_DAYS);
  const newest = today;

  const eventsOldest = addDays(today, -EVENTS_PAST_DAYS);
  const eventsNewest = addDays(today, EVENTS_FUTURE_DAYS);
  const [athlete, wellness, activities, events] = await Promise.all([
    client.getAthlete(),
    client.getWellness(oldest, newest),
    client.getActivities(oldest, newest),
    client.getEvents(eventsOldest, eventsNewest),
  ]);
  const storedEvents: StoredEvent[] = events
    .filter((e) => typeof e.start_date_local === 'string')
    .map((e) => ({ ...e, date: e.start_date_local.slice(0, 10) }));

  const stored: StoredActivity[] = activities
    .filter((a) => typeof a.start_date_local === 'string' && a.start_date_local.length >= 10)
    .map((a) => ({ ...a, id: String(a.id), date: a.start_date_local.slice(0, 10) }));
  const freshIds = new Set(stored.map((a) => a.id));

  let removedActivities = 0;
  await db.transaction('rw', [db.meta, db.wellness, db.activities, db.events, db.goals], async () => {
    await db.setMeta('athlete', athlete);
    await db.wellness.bulkPut(wellness);

    // Activities deleted in intervals.icu within the window disappear locally too.
    const stale = await db.activities
      .where('date')
      .between(oldest, newest, true, true)
      .filter((a) => !freshIds.has(a.id))
      .primaryKeys();
    removedActivities = stale.length;
    await db.activities.bulkDelete(stale);
    await db.activities.bulkPut(stored);

    // The events window is re-fetched in full every sync.
    await db.events.clear();
    await db.events.bulkPut(storedEvents);
    const { put, remove } = reconcileRaceGoals(events, await db.goals.toArray());
    await db.goals.bulkDelete(remove);
    await db.goals.bulkPut(put);

    await db.setMeta('lastSync', { date: today, at: now.toISOString() });
  });

  return { oldest, newest, wellness: wellness.length, activities: stored.length, removedActivities, events: storedEvents.length };
}

import { addDays, type IsoDate } from '../../lib/dates';
import type { CyclingHubDb, StoredActivity } from '../../store/db';
import type { IntervalsClient } from './client';

/** History pulled on first connect. 180 days gives a settled CTL and HRV baseline. */
export const INITIAL_HISTORY_DAYS = 180;
/** Days re-fetched on every incremental sync: data is often edited after the fact. */
export const RESYNC_OVERLAP_DAYS = 7;

export interface SyncResult {
  oldest: IsoDate;
  newest: IsoDate;
  wellness: number;
  activities: number;
  removedActivities: number;
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

  const [athlete, wellness, activities] = await Promise.all([
    client.getAthlete(),
    client.getWellness(oldest, newest),
    client.getActivities(oldest, newest),
  ]);

  const stored: StoredActivity[] = activities
    .filter((a) => typeof a.start_date_local === 'string' && a.start_date_local.length >= 10)
    .map((a) => ({ ...a, id: String(a.id), date: a.start_date_local.slice(0, 10) }));
  const freshIds = new Set(stored.map((a) => a.id));

  let removedActivities = 0;
  await db.transaction('rw', db.meta, db.wellness, db.activities, async () => {
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

    await db.setMeta('lastSync', { date: today, at: now.toISOString() });
  });

  return { oldest, newest, wellness: wellness.length, activities: stored.length, removedActivities };
}

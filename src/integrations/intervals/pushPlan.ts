import { contentHash, diffPush, type PushedRecord } from '../../engine/push';
import type { DayPlan } from '../../engine/week';
import type { IsoDate } from '../../lib/dates';
import type { CyclingHubDb, PushSummary } from '../../store/db';
import { IntervalsError, type IntervalsClient } from './client';

/**
 * Pushes the plan to intervals.icu: fetches the current events in the
 * window, sends only what changed, and records what was pushed so later
 * edits in intervals.icu can be recognised.
 */
export async function pushPlan(
  db: CyclingHubDb,
  client: IntervalsClient,
  days: readonly DayPlan[],
  now: Date = new Date(),
): Promise<PushSummary> {
  if (days.length === 0) throw new Error('Nothing to push.');
  const from: IsoDate = days[0]!.date;
  const to: IsoDate = days.at(-1)!.date;

  const remote = await client.getEvents(from, to);
  const records = await db.pushed.toArray();
  const diff = diffPush(days, remote, records);
  const existing = new Set(remote.map((e) => e.external_id).filter(Boolean));

  const returned = diff.upserts.length ? await client.createEventsBulk(diff.upserts) : [];
  const deletedIds: number[] = [];
  for (const d of diff.deletes) {
    try {
      await client.deleteEvent(d.eventId);
    } catch (err) {
      if (!(err instanceof IntervalsError && err.status === 404)) throw err;
    }
    deletedIds.push(d.eventId);
  }

  // Hash what intervals.icu actually stored, so its own formatting never looks like a user edit.
  const returnedByExt = new Map(returned.filter((e) => e.external_id).map((e) => [e.external_id!, e]));
  const newRecords: PushedRecord[] = diff.upserts.flatMap((sent) => {
    const stored = returnedByExt.get(sent.external_id);
    const eventId = stored?.id ?? remote.find((e) => e.external_id === sent.external_id)?.id;
    if (eventId === undefined) return [];
    return [{ externalId: sent.external_id, date: sent.start_date_local.slice(0, 10), eventId, hash: contentHash(stored ?? sent) }];
  });

  const summary: PushSummary = {
    at: now.toISOString(),
    created: diff.upserts.filter((e) => !existing.has(e.external_id)).length,
    updated: diff.upserts.filter((e) => existing.has(e.external_id)).length,
    deleted: deletedIds.length,
    userEdited: diff.userEdited.length,
    unchanged: diff.unchanged,
  };

  await db.transaction('rw', [db.pushed, db.events, db.meta], async () => {
    await db.pushed.bulkPut(newRecords);
    await db.pushed.bulkDelete(diff.deletes.map((d) => d.externalId));
    await db.events.bulkDelete(deletedIds);
    await db.events.bulkPut(returned.map((e) => ({ ...e, date: e.start_date_local.slice(0, 10) })));
    await db.setMeta('lastPush', summary);
  });
  return summary;
}

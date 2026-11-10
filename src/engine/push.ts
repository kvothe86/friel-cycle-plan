import type { IcuEvent, IcuEventInput } from '../integrations/intervals/types';
import type { IsoDate } from '../lib/dates';
import type { DayPlan } from './week';
import { toIntervalsText } from './workoutText';

/**
 * Two-way sync of planned workouts with intervals.icu (PLAN §4).
 * The app only ever touches events it created (external_id prefix). If the
 * user edits one in intervals.icu, it becomes theirs and a fixed constraint.
 */

export const EXTERNAL_PREFIX = 'cyclinghub-';

export const externalIdFor = (date: IsoDate) => `${EXTERNAL_PREFIX}${date}`;
export const isOurs = (e: Pick<IcuEvent, 'external_id'>) => !!e.external_id?.startsWith(EXTERNAL_PREFIX);

/** What we remember about each pushed event, to detect edits made in intervals.icu. */
export interface PushedRecord {
  externalId: string;
  date: IsoDate;
  eventId: number;
  /** Hash of name + description as pushed. */
  hash: string;
}

/** Small stable string hash (FNV-1a); collisions are irrelevant at this scale. */
export function hashText(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/** Normalised so harmless reformatting by intervals.icu (line endings, trailing spaces) isn't seen as an edit. */
const normalise = (text: string | null | undefined) =>
  (text ?? '').replace(/\r\n/g, '\n').split('\n').map((l) => l.trimEnd()).join('\n').trim();

export const contentHash = (e: { name?: string | null; description?: string | null }) =>
  hashText(`${normalise(e.name)}\n${normalise(e.description)}`);

export function eventFor(day: DayPlan): IcuEventInput | null {
  const w = day.workout;
  if (day.kind !== 'workout' || !w) return null;
  const description = w.outdoor
    ? `${w.description}\n\nOutdoor guidance: ${w.outdoor.summary}`
    : toIntervalsText(w);
  return {
    category: 'WORKOUT',
    start_date_local: `${day.date}T00:00:00`,
    type: 'Ride',
    name: w.name,
    description,
    external_id: externalIdFor(day.date),
    moving_time: Math.round(w.seconds),
    icu_training_load: w.tss,
  };
}

/** True when an event we pushed was changed by hand in intervals.icu since. */
export function isUserEdited(event: IcuEvent, record: PushedRecord | undefined): boolean {
  return !!record && contentHash(event) !== record.hash;
}

export interface PushDiff {
  upserts: IcuEventInput[];
  deletes: { eventId: number; externalId: string; date: IsoDate }[];
  /** Dates whose app event was edited in intervals.icu and is left alone. */
  userEdited: IsoDate[];
  unchanged: number;
}

/**
 * Compares the plan with what intervals.icu has. Days with a completed ride
 * are left alone so the planned workout stays paired with the activity.
 */
export function diffPush(
  days: readonly DayPlan[],
  remote: readonly IcuEvent[],
  records: readonly PushedRecord[],
): PushDiff {
  const remoteByExt = new Map(remote.filter(isOurs).map((e) => [e.external_id!, e]));
  const recordByExt = new Map(records.map((r) => [r.externalId, r]));
  const diff: PushDiff = { upserts: [], deletes: [], userEdited: [], unchanged: 0 };

  for (const day of days) {
    if (day.kind === 'done' || day.kind === 'fixed') continue;
    const ext = externalIdFor(day.date);
    const existing = remoteByExt.get(ext);
    const record = recordByExt.get(ext);
    if (existing && isUserEdited(existing, record)) {
      diff.userEdited.push(day.date);
      continue;
    }
    const wanted = eventFor(day);
    if (!wanted) {
      if (existing) diff.deletes.push({ eventId: existing.id, externalId: ext, date: day.date });
      continue;
    }
    if (existing && record && record.hash === contentHash(wanted)) {
      diff.unchanged++;
      continue;
    }
    diff.upserts.push(wanted);
  }
  return diff;
}

/** A workout in intervals.icu the plan must respect (the user's own, or an app workout they edited). */
export interface FixedWorkout {
  date: IsoDate;
  name: string;
  load: number;
  hard: boolean;
}

export function fixedWorkouts(events: readonly IcuEvent[], records: readonly PushedRecord[]): FixedWorkout[] {
  const recordByExt = new Map(records.map((r) => [r.externalId, r]));
  return events
    .filter((e) => e.category === 'WORKOUT')
    .filter((e) => !isOurs(e) || isUserEdited(e, recordByExt.get(e.external_id!)))
    .map((e) => {
      const load = e.icu_training_load ?? 0;
      const hours = (e.moving_time ?? 0) / 3600;
      return {
        date: e.start_date_local.slice(0, 10),
        name: e.name?.trim() || 'Workout',
        load,
        hard: (e.icu_intensity ?? 0) >= 85 || (hours > 0 && load / hours >= 72),
      };
    });
}

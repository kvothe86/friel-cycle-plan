import type { IcuEvent } from '../integrations/intervals/types';
import { compliance, plannedFor } from './compliance';
import { buildWorkout } from './library';
import { contentHash, diffPush, eventFor, externalIdFor, fixedWorkouts, type PushedRecord } from './push';
import type { DayPlan } from './week';

const ctx = { level: 4, specialty: 'allround' as const, outdoor: false };
const base = { key: false, reason: 'r', availableMinutes: 60, mode: 'any' as const, tentative: true, phase: 'base' as const, recoveryWeek: false };
const workoutDay = (date: string, minutes = 60, outdoor = false): DayPlan => ({
  ...base, date, kind: 'workout', workout: buildWorkout('endurance', minutes, { ...ctx, outdoor }),
});
const restDay = (date: string): DayPlan => ({ ...base, date, kind: 'rest' });

/** Simulates what intervals.icu stores after our upsert. */
function remoteFrom(day: DayPlan, id: number): IcuEvent {
  const e = eventFor(day)!;
  return { ...e, id };
}
const recordFor = (day: DayPlan, id: number): PushedRecord => ({ externalId: externalIdFor(day.date), date: day.date, eventId: id, hash: contentHash(eventFor(day)!) });

describe('eventFor', () => {
  it('builds a WORKOUT event with structured text', () => {
    const e = eventFor({ ...workoutDay('2026-11-12'), workout: buildWorkout('threshold', 75, ctx) })!;
    expect(e).toMatchObject({ category: 'WORKOUT', start_date_local: '2026-11-12T00:00:00', type: 'Ride', external_id: 'cyclinghub-2026-11-12', moving_time: 4500 });
    expect(e.description).toMatch(/Threshold \dx\n- \d+m \d+%/);
  });
  it('sends outdoor rides as guidance, not steps', () => {
    const e = eventFor(workoutDay('2026-11-14', 180, true))!;
    expect(e.description).toMatch(/Outdoor guidance: Steady endurance/);
    expect(e.description).not.toMatch(/^- /m);
  });
  it('sends nothing for rest days', () => {
    expect(eventFor(restDay('2026-11-13'))).toBeNull();
  });
});

describe('diffPush', () => {
  const d1 = workoutDay('2026-11-12');
  const d2 = workoutDay('2026-11-13', 90);
  const d3 = restDay('2026-11-14');

  it('creates everything on first push', () => {
    const diff = diffPush([d1, d2, d3], [], []);
    expect(diff.upserts.map((e) => e.external_id)).toEqual(['cyclinghub-2026-11-12', 'cyclinghub-2026-11-13']);
    expect(diff.deletes).toEqual([]);
  });

  it('does nothing when nothing changed', () => {
    const diff = diffPush([d1, d2], [remoteFrom(d1, 1), remoteFrom(d2, 2)], [recordFor(d1, 1), recordFor(d2, 2)]);
    expect(diff).toMatchObject({ upserts: [], deletes: [], unchanged: 2 });
  });

  it('updates changed sessions and deletes ones that became rest', () => {
    const changed = workoutDay('2026-11-12', 75);
    const nowRest = restDay('2026-11-13');
    const diff = diffPush([changed, nowRest], [remoteFrom(d1, 1), remoteFrom(d2, 2)], [recordFor(d1, 1), recordFor(d2, 2)]);
    expect(diff.upserts.map((e) => e.moving_time)).toEqual([4500]);
    expect(diff.deletes).toEqual([{ eventId: 2, externalId: 'cyclinghub-2026-11-13', date: '2026-11-13' }]);
  });

  it('leaves app workouts edited in intervals.icu alone', () => {
    const edited = { ...remoteFrom(d1, 1), description: 'my own version' };
    const diff = diffPush([workoutDay('2026-11-12', 75)], [edited], [recordFor(d1, 1)]);
    expect(diff.userEdited).toEqual(['2026-11-12']);
    expect(diff.upserts).toEqual([]);
  });

  it('never touches the user’s own workouts or days already ridden', () => {
    const own: IcuEvent = { id: 9, category: 'WORKOUT', start_date_local: '2026-11-12T00:00:00', name: 'Club ride' };
    const done: DayPlan = { ...base, date: '2026-11-12', kind: 'done', tentative: false };
    const diff = diffPush([done, restDay('2026-11-13')], [own, remoteFrom(d2, 2)], [recordFor(d2, 2)]);
    expect(diff.deletes.map((d) => d.eventId)).toEqual([2]);
  });
});

describe('fixedWorkouts', () => {
  it('treats the user’s own and edited app workouts as fixed, ignores untouched app workouts', () => {
    const d1 = workoutDay('2026-11-12');
    const events: IcuEvent[] = [
      { id: 9, category: 'WORKOUT', start_date_local: '2026-11-15T00:00:00', name: 'Club ride', icu_training_load: 120, moving_time: 7200, icu_intensity: 88 },
      remoteFrom(d1, 1),
      { ...remoteFrom(workoutDay('2026-11-13'), 2), description: 'edited' },
      { id: 3, category: 'NOTE', start_date_local: '2026-11-16T00:00:00' },
    ];
    const records = [recordFor(d1, 1), recordFor(workoutDay('2026-11-13'), 2)];
    const fixed = fixedWorkouts(events, records);
    expect(fixed.map((f) => f.date)).toEqual(['2026-11-15', '2026-11-13']);
    expect(fixed[0]).toMatchObject({ name: 'Club ride', load: 120, hard: true });
  });
});

describe('compliance', () => {
  it('classifies completed, partial, missed and over', () => {
    expect(compliance({ load: 80, seconds: 3600 }, { load: 78, seconds: 3500 }).status).toBe('completed');
    expect(compliance({ load: 80, seconds: 3600 }, { load: 40, seconds: 1800 }).status).toBe('partial');
    expect(compliance({ load: 80, seconds: 3600 }, { load: 10, seconds: 900 }).status).toBe('missed');
    expect(compliance({ load: 80, seconds: 3600 }, { load: 120, seconds: 3600 }).over).toBe(true);
  });
  it('matches activities by pairing, then by date', () => {
    const events: IcuEvent[] = [
      { id: 1, category: 'WORKOUT', start_date_local: '2026-11-12T00:00:00', external_id: 'cyclinghub-2026-11-12' },
      { id: 2, category: 'WORKOUT', start_date_local: '2026-11-13T00:00:00', external_id: 'cyclinghub-2026-11-13' },
      { id: 3, category: 'WORKOUT', start_date_local: '2026-11-14T00:00:00', name: 'not ours' },
    ];
    expect(plannedFor({ paired_event_id: 2, start_date_local: '2026-11-12T18:00:00' }, events)?.id).toBe(2);
    expect(plannedFor({ start_date_local: '2026-11-12T18:00:00' }, events)?.id).toBe(1);
    expect(plannedFor({ start_date_local: '2026-11-14T18:00:00' }, events)).toBeUndefined();
  });
});

import { useEffect } from 'react';
import { db } from '../../store/db';
import { usePlanHorizon, useToday } from '../../store/hooks';

/**
 * Logs today's committed session so progression levels can later compare
 * it with what was actually ridden (works without pushing to intervals.icu).
 *
 * Writes only when the entry actually changes: every write re-triggers the
 * live queries that feed the plan, so an unconditional write would loop.
 */
export function PlanLogger() {
  const today = useToday();
  const day = usePlanHorizon(today)?.[0];
  const w = day?.kind === 'workout' && day.date === today ? day.workout : undefined;
  const kind = day?.date === today ? day.kind : undefined;
  // Primitive dependencies only: object identities change on every recompute.
  const type = w?.type;
  const level = w?.level;
  const tss = w?.tss;
  const seconds = w?.seconds;
  const key = day?.key ?? false;

  useEffect(() => {
    if (!kind) return;
    void (async () => {
      const stored = await db.planLog.get(today);
      if (type !== undefined && level !== undefined && tss !== undefined && seconds !== undefined) {
        const entry = { date: today, type, level, tss, seconds, key };
        if (JSON.stringify(stored) !== JSON.stringify(entry)) await db.planLog.put(entry);
      } else if (kind === 'rest' && stored) {
        // Skipped or rest today: drop a stale entry. Days already ridden keep theirs.
        await db.planLog.delete(today);
      }
    })();
  }, [today, kind, type, level, tss, seconds, key]);
  return null;
}

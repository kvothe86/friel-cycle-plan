import { useEffect } from 'react';
import { db } from '../../store/db';
import { usePlanHorizon, useToday } from '../../store/hooks';

/**
 * Logs today's committed session so progression levels can later compare
 * it with what was actually ridden (works without pushing to intervals.icu).
 */
export function PlanLogger() {
  const today = useToday();
  const day = usePlanHorizon(today)?.[0];
  const w = day?.kind === 'workout' ? day.workout : undefined;
  useEffect(() => {
    if (!day || day.date !== today) return;
    if (w) void db.planLog.put({ date: today, type: w.type, level: w.level, tss: w.tss, seconds: w.seconds, key: day.key });
    // Skipped or rest today: drop a stale entry. Days already ridden keep theirs.
    else if (day.kind === 'rest') void db.planLog.delete(today);
  }, [day, w, today]);
  return null;
}

import type { DayPlan } from '../../engine/week';
import { addDays } from '../../lib/dates';
import { db } from '../../store/db';
import { useDayActions, useFtpTestDue, useToday } from '../../store/hooks';
import { useHealthStore } from '../../store/health';

/** Suggests an FTP test when the last one is old, on the next key-session day. */
export function FtpTestReminder({ days }: { days: readonly DayPlan[] }) {
  const today = useToday();
  const { due, lastTest } = useFtpTestDue(today);
  const actions = useDayActions();
  const setDayAction = useHealthStore((s) => s.setDayAction);
  if (!due || actions.some((a) => a.action === 'test' && a.date >= today)) return null;

  const slot = days.find((d) => d.kind === 'workout' && d.key && d.workout?.type !== 'long' && d.availableMinutes >= 35);
  return (
    <div className="banner info">
      {lastTest ? `Your last FTP test was on ${lastTest}.` : 'No FTP test recorded in CyclingHub yet.'} A fresh FTP keeps all your zones
      right.{' '}
      {slot && (
        <button type="button" className="small-btn" onClick={() => void setDayAction(slot.date, 'test')}>
          Schedule a test on {slot.date === today ? 'today' : slot.date}
        </button>
      )}{' '}
      <button type="button" className="small-btn" onClick={() => void db.setMeta('ftpTestSnoozedUntil', addDays(today, 14))}>
        Not now
      </button>
    </div>
  );
}

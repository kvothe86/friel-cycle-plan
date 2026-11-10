import type { DayAction } from '../../engine/adjust';
import type { DayPlan } from '../../engine/week';
import { useDayActions } from '../../store/hooks';
import { useHealthStore } from '../../store/health';

const LABEL: Record<DayAction, string> = { skip: 'skipped', easier: 'made easier', endurance: 'swapped to endurance' };

/** Quick actions for a day: skip it, make it easier, or swap to endurance (and undo). */
export function DayActions({ day }: { day: DayPlan }) {
  const actions = useDayActions();
  const setDayAction = useHealthStore((s) => s.setDayAction);
  const current = actions.find((a) => a.date === day.date)?.action;

  if (current) {
    return (
      <div className="actions">
        <span className="muted">You {LABEL[current]} this day.</span>
        <button type="button" onClick={() => void setDayAction(day.date, null)}>Undo</button>
      </div>
    );
  }
  if (day.kind !== 'workout' || day.adjustment) return null;
  return (
    <div className="actions">
      <button type="button" onClick={() => void setDayAction(day.date, 'skip')}>Skip</button>
      <button type="button" onClick={() => void setDayAction(day.date, 'easier')}>Make easier</button>
      {day.workout?.type !== 'endurance' && day.workout?.type !== 'recovery' && (
        <button type="button" onClick={() => void setDayAction(day.date, 'endurance')}>Swap to endurance</button>
      )}
    </div>
  );
}

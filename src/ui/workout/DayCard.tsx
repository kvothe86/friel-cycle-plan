import type { DayPlan } from '../../engine/week';
import { weekdayShort } from '../../lib/dates';
import { formatDuration } from '../format';
import { WorkoutProfile } from './WorkoutProfile';

interface Props {
  day: DayPlan;
  selected: boolean;
  onSelect: () => void;
  isToday: boolean;
}

export function DayCard({ day, selected, onSelect, isToday }: Props) {
  const cls = ['day', day.tentative ? 'tentative' : 'committed', `kind-${day.kind}`, selected ? 'selected' : ''].join(' ');
  return (
    <li className={cls}>
      <button type="button" className="day-btn" onClick={onSelect} aria-pressed={selected} aria-label={`${day.date}: ${day.workout?.name ?? day.kind}`}>
        <span className="day-name">
          {isToday ? 'Today' : weekdayShort(day.date)} <span className="day-date">{day.date.slice(5)}</span>
          {day.key && day.kind === 'workout' && <span className="tag key">key</span>}
        </span>
        {day.kind === 'workout' && day.workout && (
          <>
            <span className="day-title">{day.workout.name}</span>
            <span className="day-body">
              {formatDuration(day.workout.seconds)} · {day.workout.tss} TSS{day.workout.outdoor ? ' · outdoor' : ''}
            </span>
            <WorkoutProfile blocks={day.workout.blocks} height={28} mini />
          </>
        )}
        {day.kind === 'rest' && <span className="day-title muted">Rest</span>}
        {day.kind === 'event' && day.event && <span className={`day-title prio prio-${day.event.priority}`}>{day.event.priority}: {day.event.name}</span>}
        {day.kind === 'done' && (
          <>
            <span className="day-title ok">Done ✓</span>
            <span className="day-body">{day.done?.map((d) => d.name).join(', ')}</span>
          </>
        )}
      </button>
    </li>
  );
}

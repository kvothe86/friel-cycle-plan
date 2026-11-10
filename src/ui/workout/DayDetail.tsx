import type { DayPlan } from '../../engine/week';
import { weekdayShort } from '../../lib/dates';
import { WorkoutDetail } from './WorkoutDetail';

const PHASE = { base: 'Base', build: 'Build', peak: 'Peak', race: 'Race' } as const;

export function DayDetail({ day, ftp }: { day: DayPlan; ftp?: number }) {
  return (
    <div className="card day-detail">
      <div className="day-detail-head">
        <h2>
          {weekdayShort(day.date)} {day.date}
          <span className="tag">{PHASE[day.phase]}{day.recoveryWeek ? ' · recovery week' : ''}</span>
          {day.tentative && <span className="tag">tentative</span>}
        </h2>
      </div>
      <p className="why">
        <strong>Why: </strong>
        {day.reason}
      </p>
      {day.workout && <WorkoutDetail workout={day.workout} ftp={ftp} />}
      {day.kind === 'done' && (
        <ul className="plain">
          {day.done?.map((d) => (
            <li key={d.name}>
              {d.name}: {Math.round(d.load)} TSS{d.hard ? ' (hard)' : ''}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

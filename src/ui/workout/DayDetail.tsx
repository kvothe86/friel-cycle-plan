import type { DayPlan } from '../../engine/week';
import { weekdayShort } from '../../lib/dates';
import { WorkoutDetail } from './WorkoutDetail';
import type { Compliance } from '../../engine/compliance';

const PHASE = { base: 'Base', build: 'Build', peak: 'Peak', race: 'Race' } as const;

const COMPLIANCE_TEXT = { completed: 'Completed as planned', partial: 'Partly done', missed: 'Much less than planned' } as const;

interface Props {
  day: DayPlan;
  ftp?: number;
  /** Ride vs the planned session, when there was one. */
  compliance?: Compliance & { plannedName: string };
}

export function DayDetail({ day, ftp, compliance }: Props) {
  return (
    <div className="card day-detail">
      <div className="day-detail-head">
        <h2>
          {weekdayShort(day.date)} {day.date}
          <span className="tag">{PHASE[day.phase]}{day.recoveryWeek ? ' · recovery week' : ''}</span>
          {day.tentative && <span className="tag">tentative</span>}
        </h2>
      </div>
      {day.adjustment && <p className="banner warn adjustment">{day.adjustment}</p>}
      <p className="why">
        <strong>Why: </strong>
        {day.reason}
      </p>
      {day.workout && <WorkoutDetail workout={day.workout} ftp={ftp} />}
      {compliance && (
        <p className={`compliance ${compliance.status}`}>
          {COMPLIANCE_TEXT[compliance.status]}{compliance.over ? ', and harder than planned' : ''}: {Math.round(compliance.loadRatio * 100)}% of the planned load,{' '}
          {Math.round(compliance.timeRatio * 100)}% of the time ({compliance.plannedName}).
        </p>
      )}
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

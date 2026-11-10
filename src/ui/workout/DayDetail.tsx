import type { DayPlan } from '../../engine/week';
import { weekdayShort } from '../../lib/dates';
import { WorkoutDetail } from './WorkoutDetail';
import type { Compliance } from '../../engine/compliance';
import type { Workout } from '../../engine/workout';
import { toZwo } from '../../engine/zwo';

function downloadZwo(workout: Workout, date: string) {
  const url = URL.createObjectURL(new Blob([toZwo(workout)], { type: 'application/xml' }));
  const name = workout.name.replace(/×/g, 'x').replace(/[^A-Za-z0-9 ._-]/g, '').trim();
  const a = Object.assign(document.createElement('a'), { href: url, download: `${date} ${name}.zwo` });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

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
      {day.workout && !day.workout.outdoor && (
        <div className="actions">
          <button type="button" className="small-btn" onClick={() => downloadZwo(day.workout!, day.date)}>Download for Zwift (.zwo)</button>
        </div>
      )}
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

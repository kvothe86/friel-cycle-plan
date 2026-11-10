import { dateRange, toIsoDate, weekdayShort } from '../../lib/dates';
import { Placeholder } from '../Placeholder';

export const PLAN_HORIZON_DAYS = 14;

export function PlanScreen() {
  const days = dateRange(toIsoDate(new Date()), PLAN_HORIZON_DAYS);
  return (
    <Placeholder title="Next 14 days" milestone="M3">
      <ol className="day-grid" aria-label="Plan horizon">
        {days.map((iso, i) => (
          <li key={iso} className={i === 0 ? 'day committed' : 'day tentative'}>
            <span className="day-name">{weekdayShort(iso)}</span>
            <span className="day-date">{iso.slice(5)}</span>
            <span className="day-body">{i === 0 ? 'Today' : 'Tentative'}</span>
          </li>
        ))}
      </ol>
    </Placeholder>
  );
}

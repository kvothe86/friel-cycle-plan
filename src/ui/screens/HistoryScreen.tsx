import { useState } from 'react';
import { addDays } from '../../lib/dates';
import { useActivities, useCredentials, useToday } from '../../store/hooks';
import { NotConnected } from '../components/NotConnected';
import { formatDuration, formatNumber, isCycling } from '../format';

const RANGES = [14, 30, 90] as const;

export function HistoryScreen() {
  const today = useToday();
  const creds = useCredentials();
  const [days, setDays] = useState<(typeof RANGES)[number]>(30);
  const activities = useActivities(addDays(today, -(days - 1)), today);

  const totals = activities.reduce(
    (t, a) => {
      const load = a.icu_training_load ?? 0;
      if (isCycling(a.type)) t.bike += load;
      else t.other += load;
      t.time += a.moving_time ?? 0;
      return t;
    },
    { bike: 0, other: 0, time: 0 },
  );

  return (
    <section>
      <h1>History</h1>
      {!creds ? (
        <NotConnected />
      ) : (
        <>
          <div className="toolbar">
            {RANGES.map((r) => (
              <button key={r} type="button" className={r === days ? 'active' : ''} onClick={() => setDays(r)}>
                {r} days
              </button>
            ))}
            <span className="muted">
              {activities.length} activities · {formatDuration(totals.time)} · load {Math.round(totals.bike)} cycling
              {totals.other > 0 && ` + ${Math.round(totals.other)} other sports`}
            </span>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Name</th>
                <th className="num">Time</th>
                <th className="num">Load</th>
                <th className="num">IF</th>
                <th className="num">NP</th>
                <th className="num">Avg HR</th>
              </tr>
            </thead>
            <tbody>
              {activities.map((a) => (
                <tr key={a.id} className={isCycling(a.type) ? '' : 'other-sport'}>
                  <td>{a.date}</td>
                  <td>{a.type ?? '–'}</td>
                  <td>{a.name ?? '–'}</td>
                  <td className="num">{formatDuration(a.moving_time)}</td>
                  <td className="num">{formatNumber(a.icu_training_load)}</td>
                  <td className="num">{a.icu_intensity ? (a.icu_intensity / 100).toFixed(2) : '–'}</td>
                  <td className="num">{formatNumber(a.icu_weighted_avg_watts)}</td>
                  <td className="num">{formatNumber(a.average_heartrate)}</td>
                </tr>
              ))}
              {activities.length === 0 && (
                <tr>
                  <td colSpan={8} className="muted">No activities in this period.</td>
                </tr>
              )}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}

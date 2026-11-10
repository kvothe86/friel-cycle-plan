import { Link } from 'react-router-dom';
import { addDays, daysBetween, dateRange } from '../../lib/dates';
import { phaseFocus } from '../../engine/focus';
import { SPECIALTY_LABELS } from '../../engine/types';
import { useAvailability, useCredentials, usePmc, useSeasonPlan, useToday, useWellness } from '../../store/hooks';
import { LineChart } from '../components/LineChart';
import { NotConnected } from '../components/NotConnected';
import { formatDuration } from '../format';
import { PHASE_LABELS, dailyTargetCtl, eventMarkers, phaseBands } from '../season/phases';

export const SEASON_HISTORY_DAYS = 120;
/** History shown left of today on the plan chart. */
const PLAN_CHART_PAST_DAYS = 56;

export function SeasonScreen() {
  const today = useToday();
  const creds = useCredentials();
  const availability = useAvailability();
  const plan = useSeasonPlan(today);
  const pmc = usePmc(today, SEASON_HISTORY_DAYS);
  const wellness = useWellness(addDays(today, -(SEASON_HISTORY_DAYS - 1)), today);

  if (!creds) {
    return (
      <section>
        <h1>Season</h1>
        <NotConnected />
      </section>
    );
  }

  const byDate = new Map(wellness.map((w) => [w.id, w]));
  const historyDates = pmc.map((p) => p.date);

  // Plan chart: recent actual CTL + target path to the end of the plan.
  const planEnd = plan?.weeks.length ? addDays(plan.weeks.at(-1)!.start, 6) : today;
  const chartStart = addDays(today, -PLAN_CHART_PAST_DAYS);
  const chartDates = dateRange(chartStart, daysBetween(chartStart, planEnd) + 1);
  const actual = new Map(pmc.map((p) => [p.date, p.ctl]));
  const target = plan ? dailyTargetCtl(plan, today) : new Map<string, number>();
  const goal = plan?.goal;
  const weeksToGo = goal?.date ? Math.ceil(daysBetween(today, goal.date) / 7) : null;

  return (
    <section>
      <h1>Season</h1>

      {plan && (
        <>
          <div className="cards season-summary">
            <div className="card">
              <h2>Goal</h2>
              {goal ? (
                <>
                  <div className="big-text">{goal.name}</div>
                  <div className="muted">
                    {goal.date} · {weeksToGo} weeks to go · {SPECIALTY_LABELS[plan.specialty]}
                  </div>
                </>
              ) : (
                <>
                  <div className="big-text">Rolling blocks: {SPECIALTY_LABELS[plan.specialty]}</div>
                  <div className="muted">
                    No dated A goal. <Link to="/goals">Add one</Link> to plan a season around it.
                  </div>
                </>
              )}
            </div>
            <div className="card">
              <h2>Fitness (CTL)</h2>
              <dl className="facts">
                <dt>Now</dt>
                <dd>{plan.startCtl.toFixed(0)}</dd>
                <dt>{goal ? 'Planned peak' : 'In 16 weeks'}</dt>
                <dd>{(goal ? plan.peakCtl : plan.weeks.at(-1)!.targetCtl).toFixed(0)}</dd>
                <dt>Your week sustains</dt>
                <dd>~{plan.sustainableCtl.toFixed(0)}</dd>
              </dl>
            </div>
          </div>

          {(plan.warnings.length > 0 || availability?.isDefault) && (
            <div className="banner warn" role="status">
              <ul className="plain">
                {availability?.isDefault && (
                  <li>
                    The plan uses a default week. <Link to="/goals">Set your availability</Link>.
                  </li>
                )}
                {plan.warnings.map((w) => <li key={w}>{w}</li>)}
              </ul>
            </div>
          )}

          <LineChart
            title="Fitness: actual and planned"
            dates={chartDates}
            bands={phaseBands(plan, chartDates)}
            markers={eventMarkers(plan, chartDates)}
            series={[
              { label: 'Actual CTL', color: '#38bdf8', values: chartDates.map((d) => actual.get(d) ?? null) },
              { label: 'Target CTL', color: '#f97316', values: chartDates.map((d) => target.get(d) ?? null) },
            ]}
            height={280}
          />

          <table className="table weeks">
            <thead>
              <tr>
                <th>Week</th>
                <th>Phase</th>
                <th>Focus</th>
                <th className="num">Available</th>
                <th className="num">Target load</th>
                <th className="num">Target CTL</th>
                <th>Events</th>
              </tr>
            </thead>
            <tbody>
              {plan.weeks.map((w) => (
                <tr key={w.start} className={`phase-${w.recovery ? 'recovery' : w.phase}`}>
                  <td>{w.start}</td>
                  <td>
                    {PHASE_LABELS[w.phase]}
                    {w.recovery && <span className="tag">recovery</span>}
                  </td>
                  <td className="muted small">
                    {w.recovery ? 'Easy week: absorb the training' : phaseFocus(w.phase, plan.specialty).summary}
                  </td>
                  <td className="num">{w.availableMinutes ? formatDuration(w.availableMinutes * 60) : 'none'}</td>
                  <td className="num">
                    {w.targetTss}
                    {w.timeLimited && <span className="limited" title="Limited by available time"> ⏱</span>}
                  </td>
                  <td className="num">{w.targetCtl.toFixed(0)}</td>
                  <td>
                    {w.events.map((e) => (
                      <span key={e.goalId} className={`prio prio-${e.priority}`} title={e.date}>
                        {e.priority}: {e.name}
                      </span>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <h2 className="section-title">History</h2>
      <LineChart
        title={`Fitness, fatigue & form (last ${SEASON_HISTORY_DAYS} days)`}
        dates={historyDates}
        series={[
          { label: 'Form', color: '#eab308', values: pmc.map((p) => p.tsb), area: true },
          { label: 'Fitness', color: '#38bdf8', values: pmc.map((p) => p.ctl) },
          { label: 'Fatigue', color: '#c084fc', values: pmc.map((p) => p.atl) },
        ]}
        height={240}
      />
      <LineChart
        title="HRV & resting HR"
        dates={historyDates}
        series={[
          { label: 'HRV (ms)', color: '#22c55e', values: historyDates.map((d) => byDate.get(d)?.hrv ?? null) },
          { label: 'Resting HR', color: '#f87171', right: true, values: historyDates.map((d) => byDate.get(d)?.restingHR ?? null) },
        ]}
      />
    </section>
  );
}

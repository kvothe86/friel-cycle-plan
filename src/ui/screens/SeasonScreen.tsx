import { addDays } from '../../lib/dates';
import { useCredentials, usePmc, useToday, useWellness } from '../../store/hooks';
import { LineChart } from '../components/LineChart';
import { NotConnected } from '../components/NotConnected';

export const SEASON_HISTORY_DAYS = 120;

export function SeasonScreen() {
  const today = useToday();
  const creds = useCredentials();
  const pmc = usePmc(today, SEASON_HISTORY_DAYS);
  const wellness = useWellness(addDays(today, -(SEASON_HISTORY_DAYS - 1)), today);
  const byDate = new Map(wellness.map((w) => [w.id, w]));
  const dates = pmc.map((p) => p.date);

  return (
    <section>
      <h1>Season</h1>
      {!creds ? (
        <NotConnected />
      ) : (
        <>
          <LineChart
            title={`Fitness, fatigue & form (last ${SEASON_HISTORY_DAYS} days)`}
            dates={dates}
            series={[
              { label: 'Form', color: '#eab308', values: pmc.map((p) => p.tsb), area: true },
              { label: 'Fitness', color: '#38bdf8', values: pmc.map((p) => p.ctl) },
              { label: 'Fatigue', color: '#c084fc', values: pmc.map((p) => p.atl) },
            ]}
            height={260}
          />
          <LineChart
            title="HRV & resting HR"
            dates={dates}
            series={[
              { label: 'HRV (ms)', color: '#22c55e', values: dates.map((d) => byDate.get(d)?.hrv ?? null) },
              { label: 'Resting HR', color: '#f87171', right: true, values: dates.map((d) => byDate.get(d)?.restingHR ?? null) },
            ]}
          />
          <p className="muted">Phases, goals and the target CTL path arrive in M2.</p>
        </>
      )}
    </section>
  );
}

import { rideSettings, useAthlete, useCredentials, usePlanHorizon, usePmc, useReadiness, useToday, useWellness } from '../../store/hooks';
import { DayDetail } from '../workout/DayDetail';
import type { SignalKey } from '../../engine/readiness';
import { NotConnected } from '../components/NotConnected';
import { formatNumber, formatSigned } from '../format';

const SIGNAL_LABELS: Record<SignalKey, string> = {
  hrv: 'HRV',
  rhr: 'Resting HR',
  sleep: 'Sleep',
  form: 'Form',
  subjective: 'How you feel',
};

const LABEL_TEXT = { low: 'Low', reduced: 'Reduced', normal: 'Normal', high: 'High' } as const;

export function TodayScreen() {
  const today = useToday();
  const creds = useCredentials();
  const athlete = useAthlete();
  const readiness = useReadiness(today);
  const pmc = usePmc(today, 8);
  const [wellness] = useWellness(today, today);
  const now = pmc.at(-1);
  const weekAgo = pmc[0];
  const ftp = rideSettings(athlete?.sportSettings)?.ftp ?? undefined;
  const todayPlan = usePlanHorizon(today)?.[0];

  return (
    <section>
      <h1>Today</h1>
      {!creds ? (
        <NotConnected />
      ) : (
        <>
          {readiness.sickSuspected && (
            <div className="banner warn" role="alert">
              HRV has been well below your baseline and resting HR raised for two days. Are you getting sick?
              Sickness mode arrives in M5. For now, consider taking it easy.
            </div>
          )}

          <div className="cards">
            <div className={`card readiness ${readiness.label ?? 'none'}`}>
              <h2>Readiness</h2>
              <div className="big">{readiness.score ?? '–'}</div>
              <div className="sub">{readiness.label ? LABEL_TEXT[readiness.label] : 'No data for today yet'}</div>
              <ul className="signals">
                {readiness.signals.map((s) => (
                  <li key={s.key}>
                    <span>{SIGNAL_LABELS[s.key]}</span>
                    <meter min={0} max={100} low={40} high={60} optimum={100} value={s.score} />
                    <span className="muted">{s.detail}</span>
                  </li>
                ))}
              </ul>
              {readiness.missing.length > 0 && (
                <p className="muted small">
                  Not available: {readiness.missing.map((k) => SIGNAL_LABELS[k]).join(', ')}
                </p>
              )}
            </div>

            <div className="card">
              <h2>Fitness</h2>
              <dl className="facts">
                <dt>Fitness (CTL)</dt>
                <dd>
                  {formatNumber(now?.ctl)}{' '}
                  <span className="muted">({formatSigned(now && weekAgo ? now.ctl - weekAgo.ctl : null)} / 7d)</span>
                </dd>
                <dt>Fatigue (ATL)</dt>
                <dd>{formatNumber(now?.atl)}</dd>
                <dt>Form (TSB)</dt>
                <dd>{formatSigned(now?.tsb)}</dd>
                <dt>FTP</dt>
                <dd>{formatNumber(ftp)} W</dd>
              </dl>
            </div>

            <div className="card">
              <h2>Wellness today</h2>
              {wellness ? (
                <dl className="facts">
                  <dt>HRV</dt>
                  <dd>{formatNumber(wellness.hrv)} ms</dd>
                  <dt>Resting HR</dt>
                  <dd>{formatNumber(wellness.restingHR)} bpm</dd>
                  <dt>Sleep</dt>
                  <dd>{wellness.sleepSecs ? `${(wellness.sleepSecs / 3600).toFixed(1)} h` : '–'}</dd>
                  <dt>Weight</dt>
                  <dd>{formatNumber(wellness.weight, 1)} kg</dd>
                </dl>
              ) : (
                <p className="muted">No wellness entry for today yet.</p>
              )}
            </div>
          </div>

          {todayPlan && (
            <>
              <h2 className="section-title">Today's session</h2>
              <DayDetail day={todayPlan} ftp={ftp} />
            </>
          )}
        </>
      )}
    </section>
  );
}

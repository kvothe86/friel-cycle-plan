import { Link } from 'react-router-dom';
import { useActivities, useAthlete, useFtp, useCredentials, usePlanHorizon, usePmc, useReadiness, useToday, useTodayPlannedEvent, useWellness } from '../../store/hooks';
import { compliance } from '../../engine/compliance';
import { isCycling } from '../../engine/sports';
import { addDays, parseIsoDate } from '../../lib/dates';
import { DayDetail } from '../workout/DayDetail';
import { HealthCard } from '../health/HealthCard';
import { FtpTestReminder } from '../health/FtpTestReminder';
import { GettingStarted } from '../components/GettingStarted';
import { DayActions } from '../health/DayActions';
import { useHealthStore } from '../../store/health';
import type { ReadinessLabel, SignalKey } from '../../engine/readiness';
import { NotConnected } from '../components/NotConnected';
import { PageHeader } from '../components/PageHeader';
import { Ring } from '../components/Ring';
import { Sparkline } from '../components/Sparkline';
import { WorkoutProfile } from '../workout/WorkoutProfile';
import { formatDuration, formatNumber, formatSigned } from '../format';
import { C } from '../theme';

const SIGNAL_LABELS: Record<SignalKey, string> = {
  hrv: 'HRV',
  rhr: 'Resting HR',
  sleep: 'Sleep',
  form: 'Form',
  subjective: 'How you feel',
};

const LABEL_TEXT = { low: 'Low', reduced: 'Reduced', normal: 'Normal', high: 'High' } as const;
const READINESS_COLOR: Record<ReadinessLabel, string> = { high: C.good, normal: C.info, reduced: C.warn, low: C.bad };
const PHASE = { base: 'Base', build: 'Build', peak: 'Peak', race: 'Race' } as const;
const TREND_DAYS = 42;

export function TodayScreen() {
  const today = useToday();
  const creds = useCredentials();
  const athlete = useAthlete();
  const readiness = useReadiness(today);
  const pmc = usePmc(today, TREND_DAYS);
  const wellnessHistory = useWellness(addDays(today, -13), today);
  const wellness = wellnessHistory.find((w) => w.id === today);
  const now = pmc.at(-1);
  const weekAgo = pmc.at(-8);
  const ftp = useFtp();
  const horizon = usePlanHorizon(today);
  const todayPlan = horizon?.[0];
  const markSick = useHealthStore((s) => s.markSick);
  const planned = useTodayPlannedEvent(today);
  const rides = useActivities(today, today).filter((a) => isCycling(a.type));
  const todayCompliance =
    todayPlan?.kind === 'done' && planned && rides.length > 0
      ? {
          ...compliance(
            { load: planned.icu_training_load ?? 0, seconds: planned.moving_time ?? 0 },
            { load: rides.reduce((s, a) => s + (a.icu_training_load ?? 0), 0), seconds: rides.reduce((s, a) => s + (a.moving_time ?? 0), 0) },
          ),
          plannedName: planned.name ?? 'planned session',
        }
      : undefined;

  const dateLabel = parseIsoDate(today).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  const phase = todayPlan ? `${PHASE[todayPlan.phase]}${todayPlan.recoveryWeek ? ' · recovery week' : ''}` : undefined;
  const ringColor = readiness.label ? READINESS_COLOR[readiness.label] : C.faint;
  const wkg = ftp && athlete?.icu_weight ? (ftp / athlete.icu_weight).toFixed(2) : undefined;
  const byDay = new Map(wellnessHistory.map((w) => [w.id, w]));
  const lastTwoWeeks = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13));
  const w = todayPlan?.workout;

  return (
    <section className="screen">
      <PageHeader eyebrow={<>{dateLabel}{phase && <> · {phase}</>}</>} title="Today" />
      <GettingStarted />
      {!creds ? (
        <NotConnected />
      ) : (
        <>
          {readiness.sickSuspected && (
            <div className="banner warn" role="alert">
              HRV has been well below your baseline and resting HR raised for two days. Are you getting sick?{' '}
              <button type="button" className="danger small-btn" onClick={() => void markSick('mild')}>Yes, mark me sick</button>
            </div>
          )}

          <div className="bento">
            <div className={`card readiness span-5 ${readiness.label ?? 'none'}`}>
              <h2>Readiness</h2>
              <div className="readiness-body">
                <Ring value={readiness.score} color={ringColor} size={140} label="Readiness score" />
                <div>
                  <div className="sub" style={{ color: ringColor }}>{readiness.label ? LABEL_TEXT[readiness.label] : 'No data for today yet'}</div>
                  <ul className="signals">
                    {readiness.signals.map((s) => (
                      <li key={s.key}>
                        <span>{SIGNAL_LABELS[s.key]}</span>
                        <meter min={0} max={100} low={40} high={60} optimum={100} value={s.score} />
                        <span className="muted mono">{s.detail}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              {readiness.missing.length > 0 && (
                <p className="muted small">Not available: {readiness.missing.map((k) => SIGNAL_LABELS[k]).join(', ')}</p>
              )}
            </div>

            <div className={`card hero span-7 kind-${todayPlan?.kind ?? 'none'}`}>
              <h2>Today's ride</h2>
              {w ? (
                <>
                  <div className="hero-title">{w.name}</div>
                  <div className="hero-meta">
                    <span><strong>{formatDuration(w.seconds)}</strong></span>
                    <span><strong>{w.tss}</strong> TSS</span>
                    <span>IF <strong>{w.intensityFactor.toFixed(2)}</strong></span>
                    {todayPlan.key && <span className="tag key">key session</span>}
                    {todayPlan.adjustment && <span className="tag adjusted">adjusted</span>}
                    {w.outdoor && <span className="tag">outdoor</span>}
                  </div>
                  <WorkoutProfile blocks={w.blocks} height={70} />
                  <p className="hero-why">{todayPlan.reason}</p>
                  {!w.outdoor && (
                    <Link to="/player" className="button primary">Ride it</Link>
                  )}
                </>
              ) : (
                <>
                  <div className="hero-title">
                    {todayPlan?.kind === 'done' ? 'Done for today ✓' : todayPlan?.kind === 'event' ? todayPlan.event?.name : todayPlan?.kind === 'fixed' ? todayPlan.fixed?.name : 'Rest day'}
                  </div>
                  <p className="hero-why">{todayPlan?.reason ?? 'Set your availability to get a plan.'}</p>
                </>
              )}
            </div>

            <div className="card stat span-3">
              <h2>Fitness · CTL</h2>
              <div className="stat-value">{formatNumber(now?.ctl)}</div>
              <div className="stat-delta">{formatSigned(now && weekAgo ? now.ctl - weekAgo.ctl : null)} in 7 days</div>
              <Sparkline values={pmc.map((p) => p.ctl)} color={C.info} />
            </div>
            <div className="card stat span-3">
              <h2>Fatigue · ATL</h2>
              <div className="stat-value">{formatNumber(now?.atl)}</div>
              <div className="stat-delta">{formatSigned(now && weekAgo ? now.atl - weekAgo.atl : null)} in 7 days</div>
              <Sparkline values={pmc.map((p) => p.atl)} color={C.violet} />
            </div>
            <div className="card stat span-3">
              <h2>Form · TSB</h2>
              <div className={`stat-value ${now && now.tsb < -20 ? 'bad' : now && now.tsb > 5 ? 'good' : ''}`}>{formatSigned(now?.tsb)}</div>
              <div className="stat-delta">{now && now.tsb < -20 ? 'deep fatigue' : now && now.tsb > 5 ? 'fresh' : 'training'}</div>
              <Sparkline values={pmc.map((p) => p.tsb)} color={C.warn} />
            </div>
            <div className="card stat span-3 accent">
              <h2>FTP</h2>
              <div className="stat-value">{formatNumber(ftp)}<small>W</small></div>
              <div className="stat-delta">{wkg ? `${wkg} W/kg` : 'power at threshold'}</div>
            </div>

            <div className="card span-6">
              <h2>Wellness today</h2>
              {wellness ? (
                <div className="wellness-grid">
                  <div>
                    <span className="label">HRV</span>
                    <span className="value mono">{formatNumber(wellness.hrv)} ms</span>
                    <Sparkline values={lastTwoWeeks.map((d) => byDay.get(d)?.hrv ?? null)} color={C.good} height={28} area={false} />
                  </div>
                  <div>
                    <span className="label">Resting HR</span>
                    <span className="value mono">{formatNumber(wellness.restingHR)} bpm</span>
                    <Sparkline values={lastTwoWeeks.map((d) => byDay.get(d)?.restingHR ?? null)} color={C.bad} height={28} area={false} />
                  </div>
                  <div>
                    <span className="label">Sleep</span>
                    <span className="value mono">{wellness.sleepSecs ? `${(wellness.sleepSecs / 3600).toFixed(1)} h` : '–'}</span>
                    <Sparkline values={lastTwoWeeks.map((d) => (byDay.get(d)?.sleepSecs ?? 0) / 3600 || null)} color={C.info} height={28} area={false} />
                  </div>
                  <div>
                    <span className="label">Weight</span>
                    <span className="value mono">{wellness.weight ? `${formatNumber(wellness.weight, 1)} kg` : '–'}</span>
                  </div>
                </div>
              ) : (
                <p className="muted">No wellness entry for today yet.</p>
              )}
            </div>

            <div className="span-6">
              <HealthCard />
            </div>
          </div>

          {horizon && <FtpTestReminder days={horizon} />}
          {todayPlan && (
            <>
              <h2 className="section-title">Today's session</h2>
              <DayDetail day={todayPlan} ftp={ftp} compliance={todayCompliance} />
              <DayActions day={todayPlan} />
            </>
          )}
        </>
      )}
    </section>
  );
}

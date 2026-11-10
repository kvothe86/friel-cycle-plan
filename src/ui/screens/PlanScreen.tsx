import { useState } from 'react';
import { Link } from 'react-router-dom';
import { startOfWeek } from '../../lib/dates';
import { useAvailability, useCredentials, useFtp, usePlanHorizon, usePushed, useSeasonPlan, useToday } from '../../store/hooks';
import { contentHash, eventFor, externalIdFor } from '../../engine/push';
import { PushBar } from '../workout/PushBar';
import { NotConnected } from '../components/NotConnected';
import { DayCard } from '../workout/DayCard';
import { DayDetail } from '../workout/DayDetail';
import { PageHeader } from '../components/PageHeader';

export function PlanScreen() {
  const today = useToday();
  const creds = useCredentials();
  const availability = useAvailability();
  const plan = useSeasonPlan(today);
  const days = usePlanHorizon(today);
  const ftp = useFtp();
  const [selected, setSelected] = useState(today);
  const pushed = usePushed();

  if (!creds) {
    return (
      <section>
        <PageHeader eyebrow="Rolling plan · only today is fixed" title="Next 14 days" />
        <NotConnected />
      </section>
    );
  }
  if (!days || !plan) return <section className="screen"><PageHeader eyebrow="Rolling plan · only today is fixed" title="Next 14 days" /></section>;

  const current = days.find((d) => d.date === selected) ?? days[0]!;
  const pushedHash = new Map(pushed.map((r) => [r.externalId, r.hash]));
  const inSync = (d: (typeof days)[number]) => {
    const e = eventFor(d);
    return !!e && pushedHash.get(externalIdFor(d.date)) === contentHash(e);
  };
  const weeks = [...new Set(days.map((d) => startOfWeek(d.date)))]
    .map((start) => {
      const inView = days.filter((d) => startOfWeek(d.date) === start);
      const planned = inView.reduce((s, d) => s + (d.workout?.tss ?? 0), 0);
      return { start, target: plan.weeks.find((x) => x.start === start)?.targetTss, planned, count: inView.length };
    })
    .filter((w) => w.count >= 3);

  return (
    <section className="screen">
      <PageHeader eyebrow="Rolling plan · only today is fixed" title="Next 14 days" />
      <p className="muted">
        Today is fixed; the rest is a forecast and re-plans when you ride, skip, or change your availability.
        {availability?.isDefault && (
          <>
            {' '}
            <Link to="/goals">Set your weekly availability</Link> first: the plan uses a default week.
          </>
        )}
      </p>
      <PushBar days={days} />
      <ol className="day-grid plan" aria-label="Plan horizon">
        {days.map((d) => (
          <DayCard key={d.date} day={d} synced={inSync(d)} selected={d.date === current.date} onSelect={() => setSelected(d.date)} isToday={d.date === today} />
        ))}
      </ol>
      <p className="muted small">
        {weeks.map((w) => `Week of ${w.start}: ${w.planned} TSS planned from here${w.target !== undefined ? ` (week target ${w.target}, incl. what's done)` : ''}`).join(' · ')}
      </p>
      <DayDetail day={current} ftp={ftp} />
    </section>
  );
}

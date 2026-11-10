import { useEffect, useState } from 'react';
import { weekdayShort } from '../../lib/dates';
import { unfinishedRide, usePlayerStore } from '../../player/store';
import type { Recording } from '../../player/recording';
import { useCredentials, useFtp, usePlanHorizon, useToday } from '../../store/hooks';
import { formatDuration } from '../format';
import { DevicePanel } from '../player/DevicePanel';
import { RideSummary } from '../player/RideSummary';
import { RideView } from '../player/RideView';
import { PageHeader } from '../components/PageHeader';

export const DEFAULT_FTP = 200;

export function PlayerScreen() {
  const today = useToday();
  const creds = useCredentials();
  const athleteFtp = useFtp();
  const days = usePlanHorizon(today) ?? [];
  const { session, trainer, load, resume, discard } = usePlayerStore();
  const [choice, setChoice] = useState<string | null>(null);
  const [ftpInput, setFtpInput] = useState<string | null>(null);
  const [leftover, setLeftover] = useState<Recording | undefined>();

  useEffect(() => {
    if (!session) void unfinishedRide().then(setLeftover);
  }, [session]);

  if (session?.status === 'finished') return <RideSummary connected={!!creds} />;
  if (session) return <RideView />;

  const rideable = days.filter((d) => d.kind === 'workout' && d.workout);
  const selectedDate = choice ?? rideable[0]?.date;
  const selected = rideable.find((d) => d.date === selectedDate);
  const ftp = Number(ftpInput ?? athleteFtp ?? DEFAULT_FTP) || DEFAULT_FTP;

  return (
    <section className="screen">
      <PageHeader eyebrow="Indoor · ERG player" title="Ride" />

      {leftover && (
        <div className="banner warn">
          Unfinished ride: {leftover.workoutName} from {new Date(leftover.startedAt).toLocaleString()} ({formatDuration(leftover.samples.length)} recorded).{' '}
          <button type="button" className="small-btn" onClick={() => resume(leftover)}>Resume</button>{' '}
          <button
            type="button"
            className="small-btn"
            onClick={() => {
              resume(leftover);
              void usePlayerStore.getState().finish();
            }}
          >
            Finish &amp; save
          </button>{' '}
          <button type="button" className="danger small-btn" onClick={() => void discard().then(() => setLeftover(undefined))}>Discard</button>
        </div>
      )}

      <DevicePanel ftp={ftp} />

      <div className="card">
        <h2>Session</h2>
        {rideable.length === 0 ? (
          <p className="muted">No planned sessions in the next 14 days.</p>
        ) : (
          <div className="form">
            <label>
              Workout
              <select aria-label="Workout to ride" value={selectedDate} onChange={(e) => setChoice(e.target.value)}>
                {rideable.map((d) => (
                  <option key={d.date} value={d.date}>
                    {d.date === today ? 'Today' : `${weekdayShort(d.date)} ${d.date.slice(5)}`}: {d.workout!.name} ({formatDuration(d.workout!.seconds)}, {d.workout!.tss} TSS)
                  </option>
                ))}
              </select>
            </label>
            <label>
              FTP for this ride (W)
              <input type="number" min={50} max={600} value={ftpInput ?? athleteFtp ?? DEFAULT_FTP} onChange={(e) => setFtpInput(e.target.value)} className="narrow" />
            </label>
            {selected?.workout?.outdoor && <p className="muted small">An outdoor session; indoors it runs as steady ERG at the planned power.</p>}
            <div className="actions">
              <button
                type="button"
                className="primary"
                disabled={!trainer || !selected?.workout}
                onClick={() => selected?.workout && load(selected.workout, ftp, selected.date)}
              >
                Ready to ride
              </button>
              {!trainer && <span className="muted small">Connect a trainer (or the demo trainer) first.</span>}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

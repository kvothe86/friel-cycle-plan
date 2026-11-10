import * as E from '../../player/engine';
import { usePlayerStore } from '../../player/store';
import { SessionProfile } from './SessionProfile';
import { formatClock as clock } from '../format';


export function RideView() {
  const st = usePlayerStore();
  const { session, recording, live, recentPower, guard, sentTarget } = st;
  if (!session || !recording) return null;
  const pos = E.position(session);
  if (!pos) return null;
  const ftp = recording.ftp;
  const power3s = recentPower.length ? Math.round(recentPower.reduce((a, b) => a + b, 0) / recentPower.length) : undefined;
  const target = session.erg ? sentTarget ?? E.targetWatts(session, ftp, guard) : undefined;
  const nextTarget = pos.next ? Math.round(pos.next.from * session.intensity * ftp) : undefined;
  const running = session.status === 'running';
  const off = target && power3s !== undefined ? power3s - target : 0;

  return (
    <section className="ride">
      <div className="ride-head">
        <h1>{recording.workoutName}</h1>
        <span className="muted">
          {pos.segment.label || 'Step'} {pos.index + 1}/{session.segments.length}
          {pos.next && ` · next: ${pos.next.label || 'step'} ${nextTarget} W`}
        </span>
      </div>

      {guard.active && <p className="banner warn">Low cadence: target reduced to help you get back on top of the gear. Spin up above 70 rpm.</p>}
      {session.status === 'paused' && <p className="banner warn">Paused.</p>}

      <div className="tiles">
        <div className={`tile big ${Math.abs(off) > 15 ? (off > 0 ? 'over' : 'under') : ''}`}>
          <span className="tile-label">Power (3 s)</span>
          <span className="tile-value">{power3s ?? '–'}<small>W</small></span>
        </div>
        <div className="tile big target">
          <span className="tile-label">{session.erg ? 'Target' : 'ERG off'}</span>
          <span className="tile-value">{target ?? '–'}{target !== undefined && <small>W</small>}</span>
        </div>
        <div className="tile big interval">
          <span className="tile-label">Interval left</span>
          <span className="tile-value">{clock(pos.remainingInSegment)}</span>
        </div>
        <div className="tile">
          <span className="tile-label">Cadence</span>
          <span className="tile-value">{live.cadence !== undefined ? Math.round(live.cadence) : '–'}<small>rpm</small></span>
        </div>
        <div className="tile">
          <span className="tile-label">Heart rate</span>
          <span className="tile-value">{live.heartRate ?? '–'}<small>bpm</small></span>
        </div>
        <div className="tile">
          <span className="tile-label">Elapsed / left</span>
          <span className="tile-value small-value">{clock(session.elapsed)} / {clock(pos.remainingTotal)}</span>
        </div>
      </div>

      <SessionProfile segments={session.segments} elapsed={session.elapsed} samples={recording.samples} ftp={ftp} intensity={session.intensity} />

      <div className="ride-controls">
        {running ? (
          <button type="button" onClick={st.pause}>Pause</button>
        ) : (
          <button type="button" className="primary" onClick={st.start}>{session.elapsed > 0 ? 'Resume' : 'Start'}</button>
        )}
        <button type="button" onClick={st.skip} disabled={!pos.next} title={pos.next ? undefined : 'Last step: use End ride'}>Skip step</button>
        <button type="button" onClick={st.extend}>+1 min</button>
        <span className="intensity">
          <button type="button" aria-label="Easier" onClick={() => st.intensity(-E.INTENSITY_STEP)}>−</button>
          <span>{Math.round(session.intensity * 100)}%</span>
          <button type="button" aria-label="Harder" onClick={() => st.intensity(E.INTENSITY_STEP)}>+</button>
        </span>
        <button type="button" onClick={st.toggleErg}>{session.erg ? 'ERG off' : 'ERG on'}</button>
        <button type="button" className="danger" onClick={() => window.confirm('End the ride now?') && void st.finish()}>End ride</button>
      </div>
    </section>
  );
}

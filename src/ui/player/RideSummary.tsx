import { rideStats } from '../../player/recording';
import { usePlayerStore } from '../../player/store';
import { formatClock as clock } from '../format';

export function RideSummary({ connected }: { connected: boolean }) {
  const { recording, upload, uploadRide, downloadFit, discard } = usePlayerStore();
  if (!recording) return null;
  const s = rideStats(recording.samples, recording.ftp);
  return (
    <section>
      <h1>Ride done: {recording.workoutName}</h1>
      <div className="tiles">
        {[
          ['Duration', clock(s.seconds)],
          ['Avg power', `${s.avgPower} W`],
          ['NP', `${s.normalizedPower} W`],
          ['Max', `${s.maxPower} W`],
          ['TSS', String(s.tss)],
          ['IF', s.intensityFactor.toFixed(2)],
          ['Work', `${s.kilojoules} kJ`],
          ['Avg HR', s.avgHeartRate ? `${s.avgHeartRate} bpm` : '–'],
        ].map(([label, value]) => (
          <div className="tile" key={label}>
            <span className="tile-label">{label}</span>
            <span className="tile-value small-value">{value}</span>
          </div>
        ))}
      </div>
      <div className="actions">
        <button
          type="button"
          className="primary"
          disabled={!connected || upload.status === 'uploading' || upload.status === 'done'}
          onClick={() => void uploadRide()}
        >
          {upload.status === 'uploading' ? 'Uploading…' : upload.status === 'done' ? 'Uploaded ✓' : 'Upload to intervals.icu'}
        </button>
        <button type="button" onClick={() => void downloadFit()}>Download FIT</button>
        <button
          type="button"
          className="danger"
          onClick={() => (upload.status === 'done' || window.confirm('Discard this ride? It has not been uploaded.')) && void discard()}
        >
          {upload.status === 'done' ? 'Close' : 'Discard'}
        </button>
      </div>
      {upload.message && <p className={upload.status === 'error' ? 'error' : 'ok'} role="status">{upload.message}</p>}
    </section>
  );
}

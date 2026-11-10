import { rideStats } from '../../player/recording';
import { TEST_OF_TEMPLATE, estimateFtp } from '../../engine/ftpTest';
import { toIsoDate } from '../../lib/dates';
import { db } from '../../store/db';
import { useFtpInfo } from '../../store/hooks';
import { usePlayerStore } from '../../player/store';
import { formatClock as clock } from '../format';

export function RideSummary({ connected }: { connected: boolean }) {
  const { recording, upload, uploadRide, downloadFit, discard } = usePlayerStore();
  const { local } = useFtpInfo();
  if (!recording) return null;
  const s = rideStats(recording.samples, recording.ftp);
  const testKind = TEST_OF_TEMPLATE[recording.workout.templateId];
  const estimate = testKind ? estimateFtp(testKind, recording.samples.map((x) => x.power ?? 0)) : null;
  const rideDate = toIsoDate(new Date(recording.startedAt));
  const applied = !!estimate && local?.watts === estimate && local.date === rideDate;
  return (
    <section>
      <div className="eyebrow">Ride done</div>
      <h1>{recording.workoutName}</h1>
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
      {testKind && (
        <div className="card ftp-result">
          {estimate ? (
            <>
              <h2>FTP test result</h2>
              <div className="big-text">{estimate} W</div>
              <p className="muted">
                {testKind === 'ramp' ? '75 % of your best minute' : '95 % of your best 20 minutes'} · was {recording.ftp} W (
                {estimate >= recording.ftp ? '+' : ''}
                {estimate - recording.ftp} W)
              </p>
              <button
                type="button"
                className="primary"
                disabled={applied}
                onClick={() => void db.setMeta('ftp', { watts: estimate, date: rideDate, source: testKind })}
              >
                {applied ? 'Set as your FTP ✓' : `Use ${estimate} W as my FTP`}
              </button>
              <p className="muted small">Also update it in intervals.icu (Settings → Cycling → FTP) so its load and zones match.</p>
            </>
          ) : (
            <p className="muted">Too short to estimate FTP: {testKind === 'ramp' ? 'ride at least the warm-up and a few ramp steps' : 'the full 20-minute block is needed'}.</p>
          )}
        </div>
      )}
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

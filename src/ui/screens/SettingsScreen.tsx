import { useState, type FormEvent } from 'react';
import { rideSettings, useAthlete, useCredentials, useLastSync } from '../../store/hooks';
import { useSyncStore } from '../../store/sync';
import { formatNumber, formatRelativeTime } from '../format';

export function SettingsScreen() {
  const creds = useCredentials();
  const athlete = useAthlete();
  const last = useLastSync();
  const { status, error, lastResult, connect, sync, disconnect } = useSyncStore();
  const [athleteId, setAthleteId] = useState('');
  const [apiKey, setApiKey] = useState('');

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (await connect({ athleteId, apiKey })) setApiKey('');
  };

  const onDisconnect = async () => {
    if (window.confirm('Disconnect and delete all locally cached data?')) await disconnect();
  };

  const ride = rideSettings(athlete?.sportSettings);
  const busy = status === 'syncing';

  return (
    <section>
      <h1>Settings</h1>

      <div className="card">
        <h2>intervals.icu</h2>
        {creds ? (
          <>
            <dl className="facts">
              <dt>Athlete</dt>
              <dd>{athlete?.name ?? '–'} ({creds.athleteId})</dd>
              <dt>FTP</dt>
              <dd>{formatNumber(ride?.ftp)} W</dd>
              <dt>LTHR / max HR</dt>
              <dd>{formatNumber(ride?.lthr)} / {formatNumber(ride?.max_hr)} bpm</dd>
              <dt>Weight</dt>
              <dd>{formatNumber(athlete?.icu_weight, 1)} kg</dd>
              <dt>Last sync</dt>
              <dd>{formatRelativeTime(last?.at)}</dd>
            </dl>
            {lastResult && (
              <p className="muted">
                Synced {lastResult.oldest} → {lastResult.newest}: {lastResult.wellness} wellness days,{' '}
                {lastResult.activities} activities
                {lastResult.removedActivities > 0 && `, ${lastResult.removedActivities} removed`}.
              </p>
            )}
            <div className="actions">
              <button type="button" onClick={() => void sync()} disabled={busy}>
                {busy ? 'Syncing…' : 'Sync now'}
              </button>
              <button type="button" className="danger" onClick={() => void onDisconnect()} disabled={busy}>
                Disconnect
              </button>
            </div>
          </>
        ) : (
          <form onSubmit={(e) => void onSubmit(e)} className="form">
            <p className="muted">
              Find both in intervals.icu → Settings → Developer Settings. They are stored only in this browser.
            </p>
            <label>
              Athlete ID
              <input value={athleteId} onChange={(e) => setAthleteId(e.target.value)} placeholder="i123456" required autoComplete="off" />
            </label>
            <label>
              API key
              <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} required autoComplete="off" />
            </label>
            <button type="submit" disabled={busy}>{busy ? 'Connecting…' : 'Connect & sync'}</button>
          </form>
        )}
        {status === 'error' && error && <p className="error" role="alert">{error}</p>}
      </div>
    </section>
  );
}

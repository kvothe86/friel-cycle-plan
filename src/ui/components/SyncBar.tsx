import { Link } from 'react-router-dom';
import { useCredentials, useLastSync } from '../../store/hooks';
import { useSyncStore } from '../../store/sync';
import { formatRelativeTime } from '../format';

/** Sync status + manual sync button, shown in the sidebar. */
export function SyncBar() {
  const creds = useCredentials();
  const last = useLastSync();
  const { status, error, sync } = useSyncStore();

  if (!creds) {
    return (
      <div className="sync-bar">
        <Link to="/settings">Connect intervals.icu</Link>
      </div>
    );
  }
  return (
    <div className="sync-bar">
      <button type="button" onClick={() => void sync()} disabled={status === 'syncing'}>
        {status === 'syncing' ? 'Syncing…' : 'Sync now'}
      </button>
      <span className="muted">Synced {formatRelativeTime(last?.at)}</span>
      {status === 'error' && error && <span className="error" role="alert">{error}</span>}
    </div>
  );
}

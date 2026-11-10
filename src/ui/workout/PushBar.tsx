import type { DayPlan } from '../../engine/week';
import { db } from '../../store/db';
import { useLastPush, usePushSettings } from '../../store/hooks';
import { useSyncStore } from '../../store/sync';
import { formatRelativeTime } from '../format';

export function PushBar({ days }: { days: readonly DayPlan[] }) {
  const { pushStatus, pushError, push } = useSyncStore();
  const last = useLastPush();
  const settings = usePushSettings();
  const busy = pushStatus === 'pushing';

  const parts = last
    ? [
        last.created && `${last.created} created`,
        last.updated && `${last.updated} updated`,
        last.deleted && `${last.deleted} removed`,
        last.unchanged && `${last.unchanged} unchanged`,
        last.userEdited && `${last.userEdited} edited by you, kept`,
      ].filter(Boolean)
    : [];

  return (
    <div className="push-bar card">
      <button type="button" onClick={() => void push(days)} disabled={busy}>
        {busy ? 'Sending…' : 'Send to intervals.icu'}
      </button>
      <label className="check">
        <input
          type="checkbox"
          checked={settings.auto}
          onChange={(e) => void db.setMeta('pushSettings', { auto: e.target.checked })}
        />
        Send automatically when the plan changes
      </label>
      <span className="muted small">
        {last ? `Last sent ${formatRelativeTime(last.at)}${parts.length ? `: ${parts.join(', ')}` : ': nothing to change'}.` : 'Not sent yet.'}
      </span>
      {pushStatus === 'error' && pushError && <span className="error" role="alert">{pushError}</span>}
    </div>
  );
}

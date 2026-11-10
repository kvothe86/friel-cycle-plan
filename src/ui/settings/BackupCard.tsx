import { useRef, useState } from 'react';
import { toIsoDate } from '../../lib/dates';
import { exportBackup, importBackup, parseBackup } from '../../store/backup';
import { db } from '../../store/db';

export function BackupCard() {
  const input = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  const download = async () => {
    const data = await exportBackup(db);
    const url = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: `cyclinghub-backup-${toIsoDate(new Date())}.json` });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    setStatus({ ok: true, text: 'Backup downloaded.' });
  };

  const restore = async (file: File) => {
    try {
      const backup = parseBackup(await file.text());
      if (!window.confirm(`Replace your goals, availability, history and rides with the backup from ${backup.exportedAt.slice(0, 10)}?`)) return;
      await importBackup(db, backup);
      setStatus({ ok: true, text: 'Backup restored.' });
    } catch (err) {
      setStatus({ ok: false, text: (err as Error).message });
    }
  };

  return (
    <div className="card">
      <h2>Backup</h2>
      <p className="muted small">
        Everything you set up lives in this browser: goals, availability, illness, plan history and recorded rides. Download a backup now
        and then. Your API key is never included; synced intervals.icu data comes back with a sync.
      </p>
      <div className="actions">
        <button type="button" onClick={() => void download()}>Download backup</button>
        <button type="button" onClick={() => input.current?.click()}>Restore from file…</button>
        <input
          ref={input}
          type="file"
          accept="application/json,.json"
          hidden
          aria-label="Backup file"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void restore(f);
            e.target.value = '';
          }}
        />
      </div>
      {status && <p className={status.ok ? 'ok small' : 'error small'} role="status">{status.text}</p>}
    </div>
  );
}

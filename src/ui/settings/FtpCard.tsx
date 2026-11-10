import { useState } from 'react';
import { toIsoDate } from '../../lib/dates';
import { db } from '../../store/db';
import { useFtpInfo } from '../../store/hooks';

const SOURCE = { ramp: 'ramp test', ftp20: '20-minute test', manual: 'set by hand' } as const;

export function FtpCard() {
  const { ftp, local, intervals } = useFtpInfo();
  const [value, setValue] = useState('');
  return (
    <div className="card">
      <h2>FTP</h2>
      <dl className="facts">
        <dt>Used for watt targets</dt>
        <dd>
          <strong>{ftp ?? '–'} W</strong>{' '}
          <span className="muted">{local ? `(${SOURCE[local.source]}, ${local.date})` : '(from intervals.icu)'}</span>
        </dd>
        <dt>intervals.icu</dt>
        <dd>{intervals ?? '–'} W</dd>
      </dl>
      <form
        className="inline-form"
        onSubmit={(e) => {
          e.preventDefault();
          const w = Number(value);
          if (w >= 50 && w <= 600) void db.setMeta('ftp', { watts: Math.round(w), date: toIsoDate(new Date()), source: 'manual' }).then(() => setValue(''));
        }}
      >
        <input aria-label="Set FTP" type="number" min={50} max={600} placeholder="W" className="narrow" value={value} onChange={(e) => setValue(e.target.value)} />
        <button type="submit">Set</button>
        {local && (
          <button type="button" onClick={() => void db.meta.delete('ftp')}>
            Use intervals.icu value
          </button>
        )}
      </form>
      <p className="muted small">Plans are in % of FTP, so changing FTP rescales every watt target. Schedule a test from Today or a day's actions.</p>
    </div>
  );
}

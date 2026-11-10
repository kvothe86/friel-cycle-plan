import { useState } from 'react';
import { db } from '../../store/db';
import { useAvailability } from '../../store/hooks';
import { templateMinutes } from '../../engine/availability';
import type { AvailabilityTemplate, RideMode } from '../../engine/types';
import { formatDuration } from '../format';
import { MODE_LABELS, WEEKDAYS } from './labels';

export function AvailabilityCard() {
  const availability = useAvailability();
  if (!availability) return null;
  // Remount the editor when the stored template changes (e.g. after save).
  return <AvailabilityEditor key={JSON.stringify(availability)} {...availability} />;
}

function AvailabilityEditor({ template, isDefault }: { template: AvailabilityTemplate; isDefault: boolean }) {
  const [draft, setDraft] = useState<AvailabilityTemplate>(template);
  const dirty = isDefault || JSON.stringify(draft) !== JSON.stringify(template);
  const availability = { isDefault };

  const set = (i: number, patch: Partial<AvailabilityTemplate[number]>) =>
    setDraft((d) => d.map((x, j) => (j === i ? { ...x, ...patch } : x)) as AvailabilityTemplate);

  return (
    <div className="card">
      <h2>Weekly availability</h2>
      {availability.isDefault && <p className="banner warn">Using a default week. Adjust it and save.</p>}
      <table className="table compact">
        <tbody>
          {draft.map((d, i) => (
            <tr key={WEEKDAYS[i]}>
              <td>{WEEKDAYS[i]}</td>
              <td>
                <input
                  aria-label={`${WEEKDAYS[i]} minutes`}
                  type="number" min={0} max={600} step={15} className="narrow"
                  value={d.minutes}
                  onChange={(e) => set(i, { minutes: Math.max(0, Number(e.target.value) || 0) })}
                /> min
              </td>
              <td>
                <select aria-label={`${WEEKDAYS[i]} mode`} value={d.mode} onChange={(e) => set(i, { mode: e.target.value as RideMode })}>
                  {Object.entries(MODE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </td>
              <td className="muted">{d.minutes === 0 ? 'rest' : formatDuration(d.minutes * 60)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="actions">
        <button type="button" disabled={!dirty} onClick={() => void db.setMeta('availability', draft)}>Save week</button>
        <span className="muted">Total {formatDuration(templateMinutes(draft) * 60)} per week</span>
      </div>
    </div>
  );
}

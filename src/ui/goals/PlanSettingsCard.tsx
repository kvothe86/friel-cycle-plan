import { db } from '../../store/db';
import { usePlanSettings } from '../../store/hooks';
import { RAMP_PER_WEEK } from '../../engine/macro';
import type { Experience, PlanSettings } from '../../engine/types';

export function PlanSettingsCard() {
  const settings = usePlanSettings();
  const save = (patch: Partial<PlanSettings>) => void db.setMeta('planSettings', { ...settings, ...patch });

  return (
    <div className="card">
      <h2>Plan settings</h2>
      <div className="form">
        <label>
          Experience (sets the max fitness ramp)
          <select value={settings.experience} onChange={(e) => save({ experience: e.target.value as Experience })}>
            {(Object.keys(RAMP_PER_WEEK) as Experience[]).map((x) => (
              <option key={x} value={x}>{x[0]!.toUpperCase() + x.slice(1)}: up to +{RAMP_PER_WEEK[x]} CTL/week</option>
            ))}
          </select>
        </label>
        <label>
          Recovery rhythm
          <select value={settings.cycleWeeks} onChange={(e) => save({ cycleWeeks: Number(e.target.value) as 3 | 4 })}>
            <option value={4}>3:1 (three load weeks, one recovery)</option>
            <option value={3}>2:1 (masters / high life stress)</option>
          </select>
        </label>
        <label>
          FTP test
          <select value={settings.ftpTest ?? 'ramp'} onChange={(e) => save({ ftpTest: e.target.value as 'ramp' | 'ftp20' })}>
            <option value="ramp">Ramp test (35 min, until you drop)</option>
            <option value="ftp20">20-minute test (60 min, paced effort)</option>
          </select>
        </label>
      </div>
    </div>
  );
}

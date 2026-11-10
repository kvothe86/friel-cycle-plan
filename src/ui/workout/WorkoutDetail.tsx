import { POWER_ZONES, ZONE_FLOOR, timeInZones, type Step, type Workout } from '../../engine/workout';
import { compressSteps } from '../../engine/workoutText';
import { formatDuration } from '../format';
import { WorkoutProfile } from './WorkoutProfile';

const pct = (p: number) => `${Math.round(p * 100)}%`;
const watts = (p: number, ftp?: number) => (ftp ? ` · ${Math.round(p * ftp)} W` : '');

function stepText(s: Step, ftp?: number): string {
  const dur = formatDuration(s.seconds);
  if (s.kind === 'ramp') return `${dur} ramp ${pct(s.from)} → ${pct(s.to)}${ftp ? ` · ${Math.round(s.from * ftp)}→${Math.round(s.to * ftp)} W` : ''}`;
  return `${dur} @ ${pct(s.power)}${watts(s.power, ftp)}${s.cadence ? ` · ${s.cadence} rpm` : ''}`;
}

function zoneRange(zone: number, ftp?: number): string {
  const lo = ZONE_FLOOR[zone - 1]!;
  const hi = POWER_ZONES[zone - 1]!.max;
  const range = `${Math.round(lo * 100)}–${Number.isFinite(hi) ? Math.round(hi * 100) : '∞'}% FTP`;
  return ftp ? `${range} (${Math.round(lo * ftp)}–${Number.isFinite(hi) ? Math.round(hi * ftp) : '∞'} W)` : range;
}

export function WorkoutDetail({ workout, ftp }: { workout: Workout; ftp?: number }) {
  const zones = timeInZones(workout.blocks);
  return (
    <div className="workout-detail">
      <div className="workout-head">
        <h3>{workout.name}</h3>
        <span className="muted">
          {formatDuration(workout.seconds)} · {workout.tss} TSS · IF {workout.intensityFactor.toFixed(2)} · level {workout.level}
        </span>
      </div>
      <p>{workout.description}</p>

      {workout.outdoor ? (
        <div className="outdoor">
          <strong>Outdoor guidance</strong>
          <p>{workout.outdoor.summary}</p>
          <p className="muted small">
            Main zone Z{workout.outdoor.zone}: {zoneRange(workout.outdoor.zone, ftp)}
            {workout.outdoor.minShareInZone && ` · at least ${Math.round(workout.outdoor.minShareInZone * 100)}% of the ride in Z${workout.outdoor.zone} or lower`}
            {` · stay out of Z${workout.outdoor.maxZone + 1}+`}
          </p>
        </div>
      ) : (
        <>
          <WorkoutProfile blocks={workout.blocks} height={90} />
          <ol className="steps">
            {workout.blocks.map((b, bi) => (
              <li key={bi}>
                <span className="block-label">{b.label}</span>
                <ul>
                  {compressSteps(b.steps).map((r, ri) => (
                    <li key={ri}>
                      {r.count > 1 && <strong>{r.count} × </strong>}
                      {r.steps.map((s) => stepText(s, ftp)).join(r.count > 1 ? ', then ' : '')}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </>
      )}

      <div className="zone-bar" aria-label="Time in zones">
        {zones.map((secs, i) =>
          secs > 0 ? (
            <span key={i} style={{ flex: secs, background: POWER_ZONES[i]!.color }} title={`Z${i + 1} ${POWER_ZONES[i]!.name}: ${formatDuration(secs)}`}>
              {secs / workout.seconds > 0.08 ? `Z${i + 1}` : ''}
            </span>
          ) : null,
        )}
      </div>
      {!ftp && <p className="muted small">Set your FTP in intervals.icu to see watt targets.</p>}
    </div>
  );
}

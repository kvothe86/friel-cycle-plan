import type { Step, Workout } from './workout';
import { compressSteps } from './workoutText';

/**
 * Zwift workout file (.zwo). Repeats become IntervalsT, ramps Ramp, the
 * free test block FreeRide; power is a fraction of FTP as Zwift expects.
 */

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const p = (x: number) => x.toFixed(2);
const sec = (s: number) => Math.round(s);

function stepXml(s: Step): string {
  if (s.kind === 'ramp') return `<Ramp Duration="${sec(s.seconds)}" PowerLow="${p(s.from)}" PowerHigh="${p(s.to)}"/>`;
  if (s.free) return `<FreeRide Duration="${sec(s.seconds)}"/>`;
  return `<SteadyState Duration="${sec(s.seconds)}" Power="${p(s.power)}"${s.cadence ? ` Cadence="${s.cadence}"` : ''}/>`;
}

export function toZwo(workout: Workout): string {
  const lines: string[] = [];
  for (const block of workout.blocks) {
    const steps = Array.from({ length: block.repeat }, () => block.steps).flat();
    for (const g of compressSteps(steps)) {
      const [on, off] = g.steps;
      if (g.count > 1 && on?.kind === 'steady' && off?.kind === 'steady' && !on.free && !off.free) {
        const cadence = on.cadence ? ` Cadence="${on.cadence}"` : '';
        lines.push(
          `<IntervalsT Repeat="${g.count}" OnDuration="${sec(on.seconds)}" OffDuration="${sec(off.seconds)}" OnPower="${p(on.power)}" OffPower="${p(off.power)}"${cadence}/>`,
        );
      } else {
        for (let i = 0; i < g.count; i++) for (const s of g.steps) lines.push(stepXml(s));
      }
    }
  }
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<workout_file>',
    '  <author>CyclingHub</author>',
    `  <name>${esc(workout.name)}</name>`,
    `  <description>${esc(workout.description)}</description>`,
    '  <sportType>bike</sportType>',
    '  <tags/>',
    '  <workout>',
    ...lines.map((l) => `    ${l}`),
    '  </workout>',
    '</workout_file>',
    '',
  ].join('\n');
}

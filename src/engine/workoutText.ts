import type { Step, Workout } from './workout';

/**
 * Converts workouts to intervals.icu's workout text, which intervals.icu
 * parses into a structured workout and syncs on to Garmin, Wahoo and Zwift.
 *
 *   Warm-up
 *   - 10m ramp 50-75%
 *
 *   Sweet spot 3x
 *   - 13m 90%
 *   - 4m 55%
 */

export interface StepGroup {
  count: number;
  steps: Step[];
}

/** Collapses identical consecutive (work, rest) pairs into repeat groups. */
export function compressSteps(steps: readonly Step[]): StepGroup[] {
  const groups: StepGroup[] = [];
  const same = (a: readonly Step[], b: readonly Step[]) => JSON.stringify(a) === JSON.stringify(b);
  let i = 0;
  while (i < steps.length) {
    const pair = steps.slice(i, i + 2);
    let count = 1;
    while (pair.length === 2 && same(steps.slice(i + count * 2, i + count * 2 + 2), pair)) count++;
    if (count > 1) {
      groups.push({ count, steps: pair });
      i += count * 2;
    } else {
      groups.push({ count: 1, steps: [steps[i]!] });
      i++;
    }
  }
  return groups;
}

/** "1h30m", "13m", "4m45s", "15s". */
export function icuDuration(seconds: number): string {
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h ? `${h}h` : ''}${m ? `${m}m` : ''}${sec ? `${sec}s` : ''}` || '0s';
}

const pct = (p: number) => Math.round(p * 100);

export function icuStep(s: Step): string {
  // A free (ERG-off) block is sent as a ±5 % range so devices don't lock the rider to one number.
  const power =
    s.kind === 'ramp' ? `ramp ${pct(s.from)}-${pct(s.to)}%` : s.free ? `${pct(s.power) - 5}-${pct(s.power) + 5}%` : `${pct(s.power)}%`;
  const cadence = s.kind === 'steady' && s.cadence ? ` ${s.cadence}rpm` : '';
  return `- ${icuDuration(s.seconds)} ${power}${cadence}`;
}

export function toIntervalsText(workout: Workout): string {
  const sections: string[] = [workout.description];
  for (const block of workout.blocks) {
    const steps = Array.from({ length: block.repeat }, () => block.steps).flat();
    let singles: string[] = [];
    let labelled = false;
    const flushSingles = () => {
      if (singles.length) sections.push([labelled ? '' : block.label, ...singles].filter(Boolean).join('\n'));
      if (singles.length) labelled = true;
      singles = [];
    };
    for (const g of compressSteps(steps)) {
      if (g.count > 1) {
        flushSingles();
        sections.push([`${block.label} ${g.count}x`, ...g.steps.map(icuStep)].join('\n'));
        labelled = true;
      } else {
        singles.push(icuStep(g.steps[0]!));
      }
    }
    flushSingles();
  }
  return sections.join('\n\n');
}

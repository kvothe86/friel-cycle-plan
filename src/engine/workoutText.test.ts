import { buildWorkout } from './library';
import { compressSteps, icuDuration, toIntervalsText } from './workoutText';

const ctx = { level: 4, specialty: 'allround' as const, outdoor: false };

describe('intervals.icu workout text', () => {
  it('formats durations', () => {
    expect(icuDuration(600)).toBe('10m');
    expect(icuDuration(285)).toBe('4m45s');
    expect(icuDuration(15)).toBe('15s');
    expect(icuDuration(5400)).toBe('1h30m');
  });

  it('writes a structured sweet spot session with a repeat section', () => {
    const w = buildWorkout('sweetspot', 75, ctx);
    const text = toIntervalsText(w);
    expect(text.split('\n')[0]).toBe(w.description);
    expect(text).toContain('Warm-up\n- 10m ramp 50-75%');
    // The last rep (without its rest) sits outside the repeat, separated by a blank line.
    expect(text).toContain('Sweet spot 2x\n- 13m 90%\n- 4m 55%\n\n- 13m 90%\n\nEndurance\n- 10m 65%');
    expect(text).toMatch(/Cool-down\n- \S+ ramp 60-45%$/);
  });

  it('keeps cadence targets and short sprints', () => {
    const climbing = toIntervalsText(buildWorkout('threshold', 75, { ...ctx, specialty: 'climbing' }));
    expect(climbing).toMatch(/- 9m 97% 70rpm/);
    const sprints = toIntervalsText(buildWorkout('sprint', 60, ctx));
    expect(sprints).toMatch(/Sprints \dx\n- 15s 180% 110rpm\n- 4m45s 60%/);
  });

  it('total duration of the text steps equals the workout', () => {
    for (const type of ['vo2', 'overunder', 'race_sim', 'openers'] as const) {
      const w = buildWorkout(type, 70, ctx);
      const groups = w.blocks.flatMap((b) => compressSteps(b.steps));
      const secs = groups.reduce((s, g) => s + g.count * g.steps.reduce((a, x) => a + x.seconds, 0), 0);
      expect(Math.abs(secs - w.seconds)).toBeLessThanOrEqual(1);
    }
  });
});

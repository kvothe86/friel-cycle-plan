import { buildWorkout } from '../engine/library';
import {
  buildSegments, changeIntensity, extend, fractionAt, newSession, pause, position, skip, smoothTarget, start, targetWatts, tick,
  totalSeconds, updateCadenceGuard, type CadenceGuard,
} from './engine';

const workout = buildWorkout('threshold', 60, { level: 4, specialty: 'allround', outdoor: false });
const noGuard: CadenceGuard = { lowSeconds: 0, active: false };

describe('player engine', () => {
  it('builds a contiguous timeline matching the workout', () => {
    const segs = buildSegments(workout);
    expect(segs[0]!.start).toBe(0);
    for (let i = 1; i < segs.length; i++) expect(segs[i]!.start).toBe(segs[i - 1]!.end);
    expect(segs.at(-1)!.end).toBe(workout.seconds);
  });

  it('interpolates ramps (warm-up 50→75 %)', () => {
    const segs = buildSegments(workout);
    expect(fractionAt(segs, 0)).toBeCloseTo(0.5);
    expect(fractionAt(segs, segs[0]!.end / 2)).toBeCloseTo(0.625);
  });

  it('only advances while running, then finishes', () => {
    let s = newSession(workout);
    s = tick(s, 10);
    expect(s.elapsed).toBe(0);
    s = tick(start(s), 10);
    expect(s.elapsed).toBe(10);
    s = tick(pause(s), 10);
    expect(s.elapsed).toBe(10);
    s = tick(start(s), 1e6);
    expect(s.status).toBe('finished');
    expect(s.elapsed).toBe(totalSeconds(s));
  });

  it('skips to the next step and extends the current one', () => {
    let s = start(newSession(workout));
    s = skip(s);
    expect(position(s)!.index).toBe(1);
    const before = totalSeconds(s);
    const remaining = position(s)!.remainingInSegment;
    s = extend(s);
    expect(totalSeconds(s)).toBe(before + 60);
    expect(position(s)!.remainingInSegment).toBe(remaining + 60);
  });

  it('scales targets with intensity, within limits', () => {
    let s = start(skip(newSession(workout))); // first threshold interval
    const base = targetWatts(s, 300, noGuard);
    s = changeIntensity(s, 0.05);
    expect(targetWatts(s, 300, noGuard)).toBe(Math.round(base * 1.05));
    for (let i = 0; i < 20; i++) s = changeIntensity(s, -0.05);
    expect(s.intensity).toBe(0.5);
  });

  it('eases target changes', () => {
    expect(smoothTarget(null, 250)).toBe(250);
    expect(smoothTarget(150, 250)).toBe(200);
    expect(smoothTarget(248, 250)).toBe(250);
  });

  it('cuts the target after 3 s of low cadence and restores it at 70 rpm', () => {
    let g = noGuard;
    for (const rpm of [52, 50, 48]) g = updateCadenceGuard(g, rpm);
    expect(g.active).toBe(true);
    const s = start(skip(newSession(workout)));
    expect(targetWatts(s, 300, g)).toBe(Math.round(targetWatts(s, 300, noGuard) * 0.6));
    g = updateCadenceGuard(g, 65);
    expect(g.active).toBe(true);
    g = updateCadenceGuard(g, 75);
    expect(g.active).toBe(false);
    // 0 rpm (stopped pedalling) doesn't trigger the guard
    let z = noGuard;
    for (let i = 0; i < 5; i++) z = updateCadenceGuard(z, 0);
    expect(z.active).toBe(false);
  });
});

describe('free (ERG-off) test blocks', () => {
  it('turns ERG off during the 20-minute test block only', async () => {
    const { ergActive, buildSegments } = await import('./engine');
    const w = buildWorkout('ftp_test', 75, { level: 4, specialty: 'allround', outdoor: false }, 1);
    const segs = buildSegments(w);
    const test = segs.find((s) => s.free)!;
    let s = start(newSession(w));
    expect(ergActive(s)).toBe(true);
    s = { ...s, elapsed: test.start + 10 };
    expect(ergActive(s)).toBe(false);
    s = { ...s, elapsed: test.end + 10 };
    expect(ergActive(s)).toBe(true);
  });
});

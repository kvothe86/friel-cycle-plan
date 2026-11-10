import type { SessionType } from './focus';
import { buildWorkout, canRideOutdoor, minMinutesFor } from './library';
import { intensityFactor, timeInZones, workoutTss, zoneOf, type Block } from './workout';

const ctx = { level: 4, specialty: 'allround' as const, outdoor: false };
const TYPES: SessionType[] = ['recovery', 'endurance', 'long', 'tempo', 'sweetspot', 'threshold', 'overunder', 'vo2', 'anaerobic', 'sprint', 'race_sim', 'openers'];

describe('workout maths', () => {
  it('computes TSS and IF', () => {
    const hourAtFtp: Block[] = [{ label: 'x', repeat: 1, steps: [{ kind: 'steady', seconds: 3600, power: 1 }] }];
    expect(workoutTss(hourAtFtp)).toBeCloseTo(100);
    expect(intensityFactor(hourAtFtp)).toBeCloseTo(1);
    const ramp: Block[] = [{ label: 'r', repeat: 2, steps: [{ kind: 'ramp', seconds: 1800, from: 0, to: 1 }] }];
    expect(workoutTss(ramp)).toBeCloseTo(100 / 3);
  });

  it('maps power to Coggan zones', () => {
    expect(zoneOf(0.5).zone).toBe(1);
    expect(zoneOf(0.75).zone).toBe(2);
    expect(zoneOf(0.9).zone).toBe(3);
    expect(zoneOf(1.0).zone).toBe(4);
    expect(zoneOf(1.15).zone).toBe(5);
    expect(zoneOf(1.8).zone).toBe(7);
  });
});

describe('buildWorkout', () => {
  it.each(TYPES)('%s fills exactly the requested time', (type) => {
    for (const minutes of [45, 60, 75, 90, 120]) {
      const m = Math.max(minutes, minMinutesFor(type));
      const w = buildWorkout(type, m, ctx);
      expect(Math.abs(w.seconds - m * 60)).toBeLessThanOrEqual(1);
      expect(w.tss).toBeGreaterThan(0);
    }
  });

  it('classifies intensity sensibly', () => {
    expect(buildWorkout('recovery', 45, ctx).intensity).toBe('recovery');
    expect(buildWorkout('endurance', 90, ctx).intensity).toBe('easy');
    expect(buildWorkout('threshold', 75, ctx).intensity).toBe('hard');
    expect(buildWorkout('vo2', 60, ctx).intensity).toBe('hard');
  });

  it('gets harder with level', () => {
    const easy = buildWorkout('sweetspot', 90, { ...ctx, level: 2 });
    const hard = buildWorkout('sweetspot', 90, { ...ctx, level: 8 });
    expect(hard.tss).toBeGreaterThan(easy.tss);
    expect(timeInZones(hard.blocks)[2]! + timeInZones(hard.blocks)[3]!).toBeGreaterThan(timeInZones(easy.blocks)[2]! + timeInZones(easy.blocks)[3]!);
  });

  it('adds specialty cues', () => {
    expect(buildWorkout('threshold', 75, { ...ctx, specialty: 'climbing' }).description).toMatch(/rpm/);
    expect(buildWorkout('sweetspot', 75, { ...ctx, specialty: 'tt' }).description).toMatch(/TT/);
  });

  it('gives zone guidance outdoors and never intervals', () => {
    expect(canRideOutdoor('threshold')).toBe(false);
    expect(canRideOutdoor('long')).toBe(true);
    const long = buildWorkout('long', 180, { ...ctx, outdoor: true });
    expect(long.outdoor?.zone).toBe(2);
    expect(long.outdoor?.minShareInZone).toBe(0.75);
    expect(buildWorkout('endurance', 60, ctx).outdoor).toBeUndefined();
  });

  it('offers variants for VO2', () => {
    expect(buildWorkout('vo2', 60, ctx, 0).templateId).toBe('vo2');
    expect(buildWorkout('vo2', 60, ctx, 1).templateId).toBe('vo2_3030');
  });
});

import { bestAverage, estimateFtp } from './ftpTest';
import { buildWorkout } from './library';
import { flatten } from './workout';

const ctx = { level: 4, specialty: 'allround' as const, outdoor: false };

describe('FTP tests', () => {
  it('builds a ramp test with a 6 %-per-minute ramp, independent of the available time', () => {
    const w = buildWorkout('ftp_test', 90, ctx, 0);
    expect(w.templateId).toBe('ramp_test');
    expect(w.seconds).toBe(35 * 60);
    const ramp = w.blocks.find((b) => b.label === 'Ramp')!.steps.map((s) => (s.kind === 'steady' ? s.power : NaN));
    expect(ramp).toHaveLength(20);
    expect(ramp[1]! - ramp[0]!).toBeCloseTo(0.06);
  });

  it('builds a 20-minute test whose test block is ERG-free', () => {
    const w = buildWorkout('ftp_test', 75, ctx, 1);
    expect(w.templateId).toBe('ftp20');
    const free = flatten(w.blocks).filter((s) => s.kind === 'steady' && s.free);
    expect(free).toHaveLength(1);
    expect(free[0]!.seconds).toBe(1200);
  });

  it('finds the best window average', () => {
    expect(bestAverage([100, 200, 300, 200], 2)).toBe(250);
    expect(bestAverage([100], 2)).toBeNull();
  });

  it('estimates FTP from a ramp (best minute × 0.75) and a 20-min test (× 0.95)', () => {
    const ramp = [...Array(300).fill(150), ...Array(60).fill(400), ...Array(30).fill(100)];
    expect(estimateFtp('ramp', ramp)).toBe(300);
    const twenty = [...Array(600).fill(150), ...Array(1200).fill(300), ...Array(300).fill(120)];
    expect(estimateFtp('ftp20', twenty)).toBe(285);
    expect(estimateFtp('ftp20', Array(600).fill(250))).toBeNull();
  });
});

import { buildWorkout } from './library';
import { toZwo } from './zwo';

const ctx = { level: 4, specialty: 'allround' as const, outdoor: false };

describe('toZwo', () => {
  it('writes a valid Zwift workout with repeats, ramps and matching duration', () => {
    const w = buildWorkout('vo2', 60, ctx);
    const xml = toZwo(w);
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    expect(doc.querySelector('parsererror')).toBeNull();
    expect(doc.querySelector('name')!.textContent).toBe(w.name);
    expect(doc.querySelector('Ramp')!.getAttribute('PowerLow')).toBe('0.50');
    const it = doc.querySelector('IntervalsT')!;
    expect(Number(it.getAttribute('Repeat'))).toBeGreaterThan(1);
    // Total duration of all elements equals the workout.
    let total = 0;
    for (const el of Array.from(doc.querySelector('workout')!.children)) {
      total += el.tagName === 'IntervalsT'
        ? Number(el.getAttribute('Repeat')) * (Number(el.getAttribute('OnDuration')) + Number(el.getAttribute('OffDuration')))
        : Number(el.getAttribute('Duration'));
    }
    expect(Math.abs(total - w.seconds)).toBeLessThanOrEqual(2);
  });

  it('uses FreeRide for the 20-minute test, keeps cadence and escapes text', () => {
    expect(toZwo(buildWorkout('ftp_test', 75, ctx, 1))).toContain('<FreeRide Duration="1200"/>');
    expect(toZwo(buildWorkout('threshold', 75, { ...ctx, specialty: 'climbing' }))).toMatch(/Cadence="70"/);
    const w = { ...buildWorkout('endurance', 60, ctx), name: 'A & B <test>' };
    expect(toZwo(w)).toContain('<name>A &amp; B &lt;test&gt;</name>');
  });
});

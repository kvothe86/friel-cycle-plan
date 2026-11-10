import { Decoder, Profile, Stream } from '@garmin/fitsdk';
import { encodeFit } from './fit';
import { buildWorkout } from '../engine/library';
import { lapsOf, normalizedPower, rideStats, type Recording, type Sample } from './recording';

function ride(seconds = 600): Recording {
  const t0 = Date.UTC(2026, 10, 10, 18, 0, 0);
  const samples: Sample[] = Array.from({ length: seconds }, (_, i) => {
    const hard = i >= 120 && i < 420;
    return { t: t0 + i * 1000, elapsed: i, power: hard ? 280 : 160, cadence: 90, heartRate: hard ? 160 : 130, speedKmh: 32, target: hard ? 280 : 160, segment: i < 120 ? 0 : hard ? 1 : 2 };
  });
  return { id: 'r1', startedAt: t0, workoutName: 'Threshold 1 × 5 min', ftp: 280, workout: buildWorkout('threshold', 10, { level: 4, specialty: 'allround', outdoor: false }), samples, finished: true };
}

describe('ride stats', () => {
  it('computes NP ≥ average, IF and TSS', () => {
    const r = ride();
    const s = rideStats(r.samples, r.ftp);
    expect(s.avgPower).toBe(220);
    expect(s.normalizedPower).toBeGreaterThan(s.avgPower);
    expect(s.intensityFactor).toBeCloseTo(s.normalizedPower / 280, 2);
    expect(s.tss).toBeGreaterThan(5);
    expect(s.distanceM).toBeCloseTo(600 * (32 / 3.6));
    expect(normalizedPower(Array(60).fill(200))).toBeCloseTo(200);
  });

  it('makes a lap per workout step', () => {
    expect(lapsOf(ride().samples).map((l) => [l.startIndex, l.endIndex])).toEqual([[0, 120], [120, 420], [420, 600]]);
  });
});

describe('encodeFit', () => {
  it('produces a valid FIT activity that decodes back', () => {
    const bytes = encodeFit(ride());
    const decoder = new Decoder(Stream.fromByteArray(bytes));
    expect(decoder.isFIT()).toBe(true);
    expect(decoder.checkIntegrity()).toBe(true);
    const { messages: m, errors } = decoder.read();
    expect(errors).toEqual([]);
    const messages = m as Required<typeof m>;
    expect(messages.fileIdMesgs[0]!.type).toBe('activity');
    expect(messages.recordMesgs).toHaveLength(600);
    expect(messages.recordMesgs[150]!.power).toBe(280);
    expect(messages.recordMesgs[150]!.heartRate).toBe(160);
    expect(messages.lapMesgs).toHaveLength(3);
    const session = messages.sessionMesgs[0]!;
    expect(session.sport).toBe('cycling');
    expect(session.subSport).toBe('virtualActivity');
    expect(session.avgPower).toBe(220);
    expect(session.totalTimerTime).toBe(600);
    expect(messages.activityMesgs[0]!.numSessions).toBe(1);
  });

  it('uses the profile’s message numbers', () => {
    const p = Profile.MesgNum;
    expect([p.FILE_ID, p.SESSION, p.LAP, p.RECORD, p.EVENT, p.ACTIVITY]).toEqual([0, 18, 19, 20, 21, 34]);
  });

  it('refuses an empty ride', () => {
    expect(() => encodeFit({ ...ride(), samples: [] })).toThrow(/Nothing recorded/);
  });
});

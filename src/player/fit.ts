import { Encoder, Utils } from '@garmin/fitsdk';
import { lapsOf, rideStats, type Recording, type Sample } from './recording';

/**
 * Encodes a recorded ride as a FIT activity file (the format intervals.icu,
 * Strava and Garmin Connect all accept): file id, timer events, 1 Hz records,
 * a lap per workout step, session and activity summaries.
 */

/** FIT global message numbers (fixed by the FIT profile; same as Profile.MesgNum). */
const M = { FILE_ID: 0, SESSION: 18, LAP: 19, RECORD: 20, EVENT: 21, ACTIVITY: 34 } as const;

function lapSummary(samples: readonly Sample[]) {
  const powers = samples.map((s) => s.power ?? 0);
  const hrs = samples.map((s) => s.heartRate).filter((x): x is number => !!x);
  const cads = samples.map((s) => s.cadence).filter((x): x is number => x !== undefined && x > 0);
  const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : undefined);
  return {
    avgPower: avg(powers),
    maxPower: powers.length ? Math.max(...powers) : undefined,
    avgHeartRate: avg(hrs),
    maxHeartRate: hrs.length ? Math.max(...hrs) : undefined,
    avgCadence: avg(cads),
  };
}

const defined = <T extends Record<string, unknown>>(o: T) =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;

export function encodeFit(rec: Recording): Uint8Array {
  const samples = rec.samples;
  if (samples.length === 0) throw new Error('Nothing recorded.');
  const start = new Date(samples[0]!.t);
  const end = new Date(samples.at(-1)!.t + 1000);
  const stats = rideStats(samples, rec.ftp);
  const elapsed = (end.getTime() - start.getTime()) / 1000;

  const enc = new Encoder();
  // Field names follow the FIT profile; the SDK validates them at runtime.
  type FitMesg = Parameters<Encoder['onMesg']>[1];
  const write = (mesgNum: number, mesg: Record<string, unknown>) => enc.onMesg(mesgNum, mesg as FitMesg);
  write(M.FILE_ID, { type: 'activity', manufacturer: 'development', product: 0, timeCreated: start, serialNumber: 1 });
  write(M.EVENT, { timestamp: start, event: 'timer', eventType: 'start' });

  let distance = 0;
  for (const s of samples) {
    const speed = (s.speedKmh ?? 0) / 3.6;
    distance += speed;
    write(M.RECORD, defined({
      timestamp: new Date(s.t),
      power: s.power !== undefined ? Math.max(0, Math.round(s.power)) : undefined,
      cadence: s.cadence !== undefined ? Math.round(s.cadence) : undefined,
      heartRate: s.heartRate,
      speed,
      distance,
    }));
  }

  const laps = lapsOf(samples);
  for (const lap of laps) {
    const ls = samples.slice(lap.startIndex, lap.endIndex);
    const lapStart = new Date(ls[0]!.t);
    const lapEnd = new Date(ls.at(-1)!.t + 1000);
    write(M.LAP, defined({
      timestamp: lapEnd,
      startTime: lapStart,
      totalElapsedTime: (lapEnd.getTime() - lapStart.getTime()) / 1000,
      totalTimerTime: ls.length,
      event: 'lap',
      eventType: 'stop',
      sport: 'cycling',
      ...lapSummary(ls),
    }));
  }

  write(M.EVENT, { timestamp: end, event: 'timer', eventType: 'stopAll' });
  write(M.SESSION, defined({
    timestamp: end,
    startTime: start,
    totalElapsedTime: elapsed,
    totalTimerTime: stats.seconds,
    totalDistance: stats.distanceM,
    sport: 'cycling',
    subSport: 'virtualActivity',
    event: 'session',
    eventType: 'stop',
    firstLapIndex: 0,
    numLaps: laps.length,
    avgPower: stats.avgPower,
    maxPower: stats.maxPower,
    normalizedPower: stats.normalizedPower,
    avgHeartRate: stats.avgHeartRate,
    maxHeartRate: stats.maxHeartRate,
    avgCadence: stats.avgCadence,
    totalWork: stats.kilojoules * 1000,
    thresholdPower: rec.ftp,
    trainingStressScore: stats.tss,
    intensityFactor: stats.intensityFactor,
  }));
  write(M.ACTIVITY, {
    timestamp: end,
    totalTimerTime: stats.seconds,
    numSessions: 1,
    type: 'manual',
    event: 'activity',
    eventType: 'stop',
    // localDateTime is a plain number: seconds since the FIT epoch in local time.
    localTimestamp: Utils.convertDateToDateTime(end) - end.getTimezoneOffset() * 60,
  });
  return enc.close();
}

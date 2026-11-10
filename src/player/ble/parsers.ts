/**
 * Pure parsers/builders for the Bluetooth GATT profiles the player uses:
 * Fitness Machine (FTMS, 0x1826), Heart Rate (0x180D), Cycling Power (0x1818).
 * All multi-byte values are little-endian.
 */

export const UUID = {
  ftmsService: 0x1826,
  indoorBikeData: 0x2ad2,
  ftmsControlPoint: 0x2ad9,
  ftmsStatus: 0x2ada,
  heartRateService: 0x180d,
  heartRateMeasurement: 0x2a37,
  cyclingPowerService: 0x1818,
  cyclingPowerMeasurement: 0x2a63,
} as const;

export interface BikeData {
  speedKmh?: number;
  cadence?: number;
  power?: number;
  heartRate?: number;
  distanceM?: number;
}

/** FTMS Indoor Bike Data (0x2AD2). Field order follows the flag bits. */
export function parseIndoorBikeData(view: DataView): BikeData {
  const flags = view.getUint16(0, true);
  let o = 2;
  const out: BikeData = {};
  const has = (bit: number) => (flags & (1 << bit)) !== 0;

  // Bit 0 is "More Data": instantaneous speed is present when it is 0.
  if (!has(0)) {
    out.speedKmh = view.getUint16(o, true) / 100;
    o += 2;
  }
  if (has(1)) o += 2; // average speed
  if (has(2)) {
    out.cadence = view.getUint16(o, true) / 2;
    o += 2;
  }
  if (has(3)) o += 2; // average cadence
  if (has(4)) {
    out.distanceM = view.getUint16(o, true) | (view.getUint8(o + 2) << 16);
    o += 3;
  }
  if (has(5)) o += 2; // resistance level
  if (has(6)) {
    out.power = view.getInt16(o, true);
    o += 2;
  }
  if (has(7)) o += 2; // average power
  if (has(8)) o += 5; // expended energy
  if (has(9)) out.heartRate = view.getUint8(o); // later fields (MET, times) aren't used
  return out;
}

/** Heart Rate Measurement (0x2A37): bit 0 of the flags selects uint8 or uint16. */
export function parseHeartRate(view: DataView): number {
  const flags = view.getUint8(0);
  return flags & 0x01 ? view.getUint16(1, true) : view.getUint8(1);
}

export interface PowerMeasurement {
  power: number;
  crank?: { revolutions: number; eventTime: number };
}

/** Cycling Power Measurement (0x2A63): power plus optional crank data for cadence. */
export function parseCyclingPower(view: DataView): PowerMeasurement {
  const flags = view.getUint16(0, true);
  const out: PowerMeasurement = { power: view.getInt16(2, true) };
  let o = 4;
  if (flags & 0x01) o += 1; // pedal power balance
  if (flags & 0x04) o += 2; // accumulated torque
  if (flags & 0x10) o += 6; // wheel revolution data
  if (flags & 0x20) {
    out.crank = { revolutions: view.getUint16(o, true), eventTime: view.getUint16(o + 2, true) };
  }
  return out;
}

/** Cadence from two crank readings (handles 16-bit rollover; event time in 1/1024 s). */
export function cadenceFromCrank(
  prev: { revolutions: number; eventTime: number },
  next: { revolutions: number; eventTime: number },
): number | null {
  const revs = (next.revolutions - prev.revolutions + 0x10000) % 0x10000;
  const ticks = (next.eventTime - prev.eventTime + 0x10000) % 0x10000;
  if (ticks === 0) return null; // no new crank event since the last reading
  return (revs / (ticks / 1024)) * 60;
}

/** FTMS control point commands. */
export const FtmsCommand = {
  requestControl: () => new Uint8Array([0x00]),
  reset: () => new Uint8Array([0x01]),
  startOrResume: () => new Uint8Array([0x07]),
  stop: () => new Uint8Array([0x08, 0x01]),
  pause: () => new Uint8Array([0x08, 0x02]),
  /** ERG: target power in watts (sint16). */
  setTargetPower: (watts: number) => {
    const w = Math.max(0, Math.min(2000, Math.round(watts)));
    return new Uint8Array([0x05, w & 0xff, (w >> 8) & 0xff]);
  },
  /** Free ride: simulation with a grade in % (wind 0, crr 0.004, cw 0.51). */
  setSimulation: (gradePercent: number) => {
    const grade = Math.round(gradePercent * 100);
    const g = grade < 0 ? grade + 0x10000 : grade;
    return new Uint8Array([0x11, 0x00, 0x00, g & 0xff, (g >> 8) & 0xff, 40, 51]);
  },
};

export interface ControlPointResponse {
  requestOpcode: number;
  result: 'success' | 'not-supported' | 'invalid-parameter' | 'failed' | 'not-permitted' | 'unknown';
}

const RESULTS = { 1: 'success', 2: 'not-supported', 3: 'invalid-parameter', 4: 'failed', 5: 'not-permitted' } as const;

export function parseControlPointResponse(view: DataView): ControlPointResponse | null {
  if (view.byteLength < 3 || view.getUint8(0) !== 0x80) return null;
  const code = view.getUint8(2) as keyof typeof RESULTS;
  return { requestOpcode: view.getUint8(1), result: RESULTS[code] ?? 'unknown' };
}

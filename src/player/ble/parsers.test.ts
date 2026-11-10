import {
  FtmsCommand, cadenceFromCrank, parseControlPointResponse, parseCyclingPower, parseHeartRate, parseIndoorBikeData,
} from './parsers';

const dv = (...bytes: number[]) => new DataView(new Uint8Array(bytes).buffer);

describe('FTMS Indoor Bike Data', () => {
  it('parses speed, cadence and power (typical Elite/Wahoo frame)', () => {
    // flags 0x0044: speed present (bit0 = 0), cadence (bit2), power (bit6)
    // speed 32.50 km/h = 3250 → 0x0CB2; cadence 90 rpm = 180 → 0x00B4; power 250 W → 0x00FA
    expect(parseIndoorBikeData(dv(0x44, 0x00, 0xb2, 0x0c, 0xb4, 0x00, 0xfa, 0x00))).toEqual({ speedKmh: 32.5, cadence: 90, power: 250 });
  });

  it('skips optional fields it does not use and reads HR at the end', () => {
    // flags: avg speed (1), cadence (2), distance (4), power (6), energy (8), HR (9) = 0x0356
    const frame = dv(
      0x56, 0x03,
      0x10, 0x27, // speed 100.00
      0x00, 0x00, // avg speed
      0x64, 0x00, // cadence 50
      0x10, 0x27, 0x00, // distance 10000 m
      0x2c, 0x01, // power 300
      0x00, 0x00, 0x00, 0x00, 0x00, // energy
      0x8c, // HR 140
    );
    expect(parseIndoorBikeData(frame)).toEqual({ speedKmh: 100, cadence: 50, distanceM: 10000, power: 300, heartRate: 140 });
  });

  it('handles "more data" frames without speed', () => {
    expect(parseIndoorBikeData(dv(0x41, 0x00, 0x96, 0x00))).toEqual({ power: 150 });
  });
});

describe('Heart Rate', () => {
  it('reads uint8 and uint16 formats', () => {
    expect(parseHeartRate(dv(0x00, 0x8c))).toBe(140);
    expect(parseHeartRate(dv(0x01, 0x2c, 0x01))).toBe(300);
  });
});

describe('Cycling Power', () => {
  it('reads power and crank data, and computes cadence across rollover', () => {
    // flags 0x20 crank data; power 200; revs 65535, time 64512
    const a = parseCyclingPower(dv(0x20, 0x00, 0xc8, 0x00, 0xff, 0xff, 0x00, 0xfc));
    expect(a).toEqual({ power: 200, crank: { revolutions: 65535, eventTime: 64512 } });
    // +2 revolutions in 1.25 s (1280 ticks), with both counters rolling over
    const b = { revolutions: 1, eventTime: (64512 + 1280) % 65536 };
    expect(cadenceFromCrank(a.crank!, b)).toBeCloseTo(96);
  });
});

describe('FTMS control point', () => {
  it('builds commands', () => {
    expect([...FtmsCommand.requestControl()]).toEqual([0x00]);
    expect([...FtmsCommand.setTargetPower(260)]).toEqual([0x05, 0x04, 0x01]);
    expect([...FtmsCommand.setTargetPower(-5)]).toEqual([0x05, 0, 0]);
    expect([...FtmsCommand.setSimulation(-1.5)]).toEqual([0x11, 0, 0, 0x6a, 0xff, 40, 51]);
  });

  it('parses responses', () => {
    expect(parseControlPointResponse(dv(0x80, 0x05, 0x01))).toEqual({ requestOpcode: 5, result: 'success' });
    expect(parseControlPointResponse(dv(0x80, 0x00, 0x05))).toEqual({ requestOpcode: 0, result: 'not-permitted' });
    expect(parseControlPointResponse(dv(0x01))).toBeNull();
  });
});

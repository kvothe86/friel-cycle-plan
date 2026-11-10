import { FtmsTrainer } from './devices';
import { UUID } from './parsers';

/** A fake GATT characteristic: records writes, can push notifications. */
class FakeChar extends EventTarget {
  writes: number[][] = [];
  value?: DataView;
  async startNotifications() {
    return this;
  }
  async writeValueWithResponse(data: Uint8Array) {
    this.writes.push([...data]);
  }
  notify(bytes: number[]) {
    this.value = new DataView(new Uint8Array(bytes).buffer);
    this.dispatchEvent(new Event('characteristicvaluechanged'));
  }
}

function fakeTrainer() {
  const bike = new FakeChar();
  const cp = new FakeChar();
  const service = { getCharacteristic: async (uuid: number) => (uuid === UUID.indoorBikeData ? bike : cp) };
  const server = { getPrimaryService: async () => service };
  const device = Object.assign(new EventTarget(), {
    name: 'SUITO-T 12345',
    gatt: { connect: async () => server, disconnect: () => undefined },
  });
  return { device: device as unknown as BluetoothDevice, bike, cp };
}

describe('FtmsTrainer', () => {
  it('requests control, starts, sets ERG targets without duplicate writes, and parses data', async () => {
    const { device, bike, cp } = fakeTrainer();
    const t = new FtmsTrainer(device);
    await t.connect();
    expect(t.name).toBe('SUITO-T 12345');
    expect(cp.writes).toEqual([[0x00], [0x07]]);

    await t.setTargetPower(250);
    await t.setTargetPower(250);
    await t.setTargetPower(180.4);
    expect(cp.writes.slice(2)).toEqual([[0x05, 250, 0], [0x05, 180, 0]]);

    const seen: unknown[] = [];
    t.onData((d) => seen.push(d));
    bike.notify([0x44, 0x00, 0xb2, 0x0c, 0xb4, 0x00, 0xfa, 0x00]);
    expect(seen).toEqual([{ speedKmh: 32.5, cadence: 90, power: 250 }]);

    await t.setFreeRide();
    expect(cp.writes.at(-1)).toEqual([0x11, 0, 0, 0, 0, 40, 51]);
  });

  it('restores the last target after reconnecting', async () => {
    const { device, cp } = fakeTrainer();
    const t = new FtmsTrainer(device);
    await t.connect();
    await t.setTargetPower(220);
    cp.writes = [];
    await t.connect(); // what the auto-reconnect does
    expect(cp.writes).toEqual([[0x00], [0x07], [0x05, 220, 0]]);
  });

  it('reports a refused command', async () => {
    const { device, cp } = fakeTrainer();
    const t = new FtmsTrainer(device);
    await t.connect();
    cp.notify([0x80, 0x05, 0x05]);
    expect(t.lastError).toMatch(/0x5: not-permitted/);
  });
});

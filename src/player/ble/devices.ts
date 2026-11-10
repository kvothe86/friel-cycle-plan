import {
  FtmsCommand, UUID, cadenceFromCrank, parseControlPointResponse, parseCyclingPower, parseHeartRate, parseIndoorBikeData,
  type BikeData,
} from './parsers';

/**
 * Device drivers. Everything the player needs goes through these small
 * interfaces, so a simulated trainer can stand in for a real one.
 */

export type ConnectionState = 'connected' | 'reconnecting' | 'disconnected';

export interface Device {
  name: string;
  onState(cb: (s: ConnectionState) => void): () => void;
  disconnect(): void;
}

export interface Trainer extends Device {
  kind: 'ftms' | 'demo';
  onData(cb: (d: BikeData) => void): () => void;
  /** ERG mode: hold this power. */
  setTargetPower(watts: number): Promise<void>;
  /** ERG off: ride like a flat road. */
  setFreeRide(): Promise<void>;
}

export interface HeartRateSensor extends Device {
  onHeartRate(cb: (bpm: number) => void): () => void;
}

export interface PowerMeter extends Device {
  onPower(cb: (d: { power: number; cadence?: number }) => void): () => void;
}

export const hasWebBluetooth = () => typeof navigator !== 'undefined' && 'bluetooth' in navigator;

class Emitter<T> {
  private listeners = new Set<(v: T) => void>();
  on(cb: (v: T) => void) {
    this.listeners.add(cb);
    return () => void this.listeners.delete(cb);
  }
  emit(v: T) {
    for (const cb of this.listeners) cb(v);
  }
}

const RECONNECT_ATTEMPTS = 5;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Shared GATT plumbing: connect, auto-reconnect with backoff, and a write
 * queue (Web Bluetooth rejects overlapping GATT operations).
 */
abstract class BleDevice implements Device {
  protected readonly device: BluetoothDevice;
  protected readonly state = new Emitter<ConnectionState>();
  private queue: Promise<unknown> = Promise.resolve();
  private closing = false;

  constructor(device: BluetoothDevice) {
    this.device = device;
    device.addEventListener('gattserverdisconnected', () => void this.reconnect());
  }

  get name() {
    return this.device.name ?? 'Bluetooth device';
  }

  onState(cb: (s: ConnectionState) => void) {
    return this.state.on(cb);
  }

  /** Subscribes to characteristics; called on first connect and after every reconnect. */
  protected abstract setup(server: BluetoothRemoteGATTServer): Promise<void>;

  async connect() {
    const server = await this.device.gatt!.connect();
    await this.setup(server);
    this.state.emit('connected');
  }

  private async reconnect() {
    if (this.closing) return;
    this.state.emit('reconnecting');
    for (let i = 0; i < RECONNECT_ATTEMPTS && !this.closing; i++) {
      await sleep(1000 * 2 ** i);
      try {
        await this.connect();
        return;
      } catch {
        /* try again */
      }
    }
    this.state.emit('disconnected');
  }

  protected write(char: BluetoothRemoteGATTCharacteristic, data: Uint8Array) {
    const run = () => char.writeValueWithResponse(data as BufferSource);
    const p = this.queue.then(run, run);
    this.queue = p.catch(() => undefined);
    return p;
  }

  disconnect() {
    this.closing = true;
    this.device.gatt?.disconnect();
    this.state.emit('disconnected');
  }
}

/** FTMS smart trainer (Elite Suito/Direto, Wahoo Kickr, Tacx Neo, Zwift Hub, …). */
export class FtmsTrainer extends BleDevice implements Trainer {
  readonly kind = 'ftms' as const;
  private readonly data = new Emitter<BikeData>();
  private controlPoint?: BluetoothRemoteGATTCharacteristic;
  private lastTarget: number | null = null;
  private freeRide = false;
  lastError: string | null = null;

  static async request(): Promise<FtmsTrainer> {
    const device = await navigator.bluetooth.requestDevice({
      filters: [{ services: [UUID.ftmsService] }],
      optionalServices: [UUID.cyclingPowerService, UUID.heartRateService],
    });
    const t = new FtmsTrainer(device);
    await t.connect();
    return t;
  }

  onData(cb: (d: BikeData) => void) {
    return this.data.on(cb);
  }

  protected async setup(server: BluetoothRemoteGATTServer) {
    const svc = await server.getPrimaryService(UUID.ftmsService);
    const bike = await svc.getCharacteristic(UUID.indoorBikeData);
    bike.addEventListener('characteristicvaluechanged', (e) => {
      const v = (e.target as BluetoothRemoteGATTCharacteristic).value;
      if (v) this.data.emit(parseIndoorBikeData(v));
    });
    await bike.startNotifications();

    this.controlPoint = await svc.getCharacteristic(UUID.ftmsControlPoint);
    this.controlPoint.addEventListener('characteristicvaluechanged', (e) => {
      const v = (e.target as BluetoothRemoteGATTCharacteristic).value;
      const res = v && parseControlPointResponse(v);
      if (res && res.result !== 'success') this.lastError = `Trainer refused command 0x${res.requestOpcode.toString(16)}: ${res.result}`;
    });
    await this.controlPoint.startNotifications();
    // The trainer only accepts commands after control is requested.
    await this.write(this.controlPoint, FtmsCommand.requestControl());
    await this.write(this.controlPoint, FtmsCommand.startOrResume());
    // After a reconnect, restore what the rider had.
    if (this.freeRide) await this.write(this.controlPoint, FtmsCommand.setSimulation(0));
    else if (this.lastTarget !== null) await this.write(this.controlPoint, FtmsCommand.setTargetPower(this.lastTarget));
  }

  async setTargetPower(watts: number) {
    this.freeRide = false;
    const w = Math.round(watts);
    if (w === this.lastTarget || !this.controlPoint) return;
    this.lastTarget = w;
    await this.write(this.controlPoint, FtmsCommand.setTargetPower(w));
  }

  async setFreeRide() {
    if (this.freeRide || !this.controlPoint) return;
    this.freeRide = true;
    this.lastTarget = null;
    await this.write(this.controlPoint, FtmsCommand.setSimulation(0));
  }
}

export class BleHeartRate extends BleDevice implements HeartRateSensor {
  private readonly hr = new Emitter<number>();

  static async request(): Promise<BleHeartRate> {
    const device = await navigator.bluetooth.requestDevice({ filters: [{ services: [UUID.heartRateService] }] });
    const s = new BleHeartRate(device);
    await s.connect();
    return s;
  }

  onHeartRate(cb: (bpm: number) => void) {
    return this.hr.on(cb);
  }

  protected async setup(server: BluetoothRemoteGATTServer) {
    const ch = await (await server.getPrimaryService(UUID.heartRateService)).getCharacteristic(UUID.heartRateMeasurement);
    ch.addEventListener('characteristicvaluechanged', (e) => {
      const v = (e.target as BluetoothRemoteGATTCharacteristic).value;
      if (v) this.hr.emit(parseHeartRate(v));
    });
    await ch.startNotifications();
  }
}

export class BlePowerMeter extends BleDevice implements PowerMeter {
  private readonly power = new Emitter<{ power: number; cadence?: number }>();
  private lastCrank?: { revolutions: number; eventTime: number };
  private lastCadence?: number;

  static async request(): Promise<BlePowerMeter> {
    const device = await navigator.bluetooth.requestDevice({ filters: [{ services: [UUID.cyclingPowerService] }] });
    const s = new BlePowerMeter(device);
    await s.connect();
    return s;
  }

  onPower(cb: (d: { power: number; cadence?: number }) => void) {
    return this.power.on(cb);
  }

  protected async setup(server: BluetoothRemoteGATTServer) {
    const ch = await (await server.getPrimaryService(UUID.cyclingPowerService)).getCharacteristic(UUID.cyclingPowerMeasurement);
    ch.addEventListener('characteristicvaluechanged', (e) => {
      const v = (e.target as BluetoothRemoteGATTCharacteristic).value;
      if (!v) return;
      const m = parseCyclingPower(v);
      if (m.crank) {
        const c = this.lastCrank ? cadenceFromCrank(this.lastCrank, m.crank) : null;
        if (c !== null) this.lastCadence = c;
        this.lastCrank = m.crank;
      }
      this.power.emit({ power: m.power, cadence: this.lastCadence });
    });
    await ch.startNotifications();
  }
}

/**
 * Simulated trainer + heart rate for trying the player without hardware.
 * Power follows the target with a short lag and some noise.
 */
export class DemoTrainer implements Trainer {
  readonly kind = 'demo' as const;
  readonly name = 'Demo trainer';
  private readonly data = new Emitter<BikeData>();
  private readonly state = new Emitter<ConnectionState>();
  private target = 100;
  private power = 0;
  private hr = 95;
  private timer: ReturnType<typeof setInterval>;

  constructor(private readonly ftp = 250) {
    this.timer = setInterval(() => this.step(), 1000);
  }

  private step() {
    this.power += (this.target - this.power) * 0.5;
    const noisy = Math.max(0, Math.round(this.power + (Math.random() - 0.5) * 12));
    const hrTarget = 90 + (this.power / this.ftp) * 80;
    this.hr += (hrTarget - this.hr) * 0.08;
    const cadence = 85 + Math.round(Math.random() * 8);
    this.data.emit({ power: noisy, cadence, speedKmh: Math.round(Math.cbrt(noisy) * 5.5 * 10) / 10, heartRate: Math.round(this.hr) });
  }

  onData(cb: (d: BikeData) => void) {
    return this.data.on(cb);
  }
  onState(cb: (s: ConnectionState) => void) {
    queueMicrotask(() => cb('connected'));
    return this.state.on(cb);
  }
  async setTargetPower(watts: number) {
    this.target = watts;
  }
  async setFreeRide() {
    this.target = this.ftp * 0.65;
  }
  disconnect() {
    clearInterval(this.timer);
    this.state.emit('disconnected');
  }
}

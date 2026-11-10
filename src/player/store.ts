import { create } from 'zustand';
import type { Workout } from '../engine/workout';
import { externalIdFor } from '../engine/push';
import { IntervalsClient } from '../integrations/intervals/client';
import { db } from '../store/db';
import { useSyncStore } from '../store/sync';
import {
  BleHeartRate, BlePowerMeter, DemoTrainer, FtmsTrainer,
  type ConnectionState, type HeartRateSensor, type PowerMeter, type Trainer,
} from './ble/devices';
import * as E from './engine';
import type { Recording, Sample } from './recording';

/** The FIT SDK is large; load it only when a ride is saved or uploaded. */
const loadFit = () => import('./fit').then((m) => m.encodeFit);

/**
 * Player orchestration: devices → live readings → 1 Hz tick of the ERG
 * engine → target to the trainer → sample to the recording (saved every
 * 10 s so a crash or closed tab can be resumed).
 */

export const SAVE_EVERY_SAMPLES = 10;

export interface Live {
  power?: number;
  cadence?: number;
  heartRate?: number;
  speedKmh?: number;
}

type DeviceSlot = 'trainer' | 'hr' | 'pm';

interface PlayerState {
  trainer?: Trainer;
  hr?: HeartRateSensor;
  pm?: PowerMeter;
  deviceState: Partial<Record<DeviceSlot, ConnectionState>>;
  live: Live;
  /** Last 3 power readings for a steadier display. */
  recentPower: number[];
  session?: E.Session;
  recording?: Recording;
  guard: E.CadenceGuard;
  sentTarget: number | null;
  error: string | null;
  upload: { status: 'idle' | 'uploading' | 'done' | 'error'; message?: string };

  connect: (slot: DeviceSlot, demoFtp?: number) => Promise<void>;
  disconnect: (slot: DeviceSlot) => void;
  load: (workout: Workout, ftp: number, plannedDate?: string) => void;
  resume: (rec: Recording) => void;
  start: () => void;
  pause: () => void;
  skip: () => void;
  extend: () => void;
  intensity: (delta: number) => void;
  toggleErg: () => void;
  finish: () => Promise<void>;
  discard: () => Promise<void>;
  uploadRide: () => Promise<void>;
  downloadFit: () => Promise<void>;
  tick: () => void;
}

let timer: ReturnType<typeof setInterval> | undefined;
let wakeLock: WakeLockSentinel | undefined;
const unsubs: Partial<Record<DeviceSlot, (() => void)[]>> = {};

function startTicker(get: () => PlayerState) {
  if (timer) return;
  timer = setInterval(() => get().tick(), 1000);
  void navigator.wakeLock?.request('screen').then((w) => (wakeLock = w)).catch(() => undefined);
}

function stopTicker() {
  if (timer) clearInterval(timer);
  timer = undefined;
  void wakeLock?.release().catch(() => undefined);
  wakeLock = undefined;
}

const message = (err: unknown) => (err instanceof Error ? err.message : String(err));

export const usePlayerStore = create<PlayerState>((set, get) => ({
  deviceState: {},
  live: {},
  recentPower: [],
  guard: { lowSeconds: 0, active: false },
  sentTarget: null,
  error: null,
  upload: { status: 'idle' },

  async connect(slot, demoFtp) {
    set({ error: null });
    try {
      const onState = (s: ConnectionState) => set((st) => ({ deviceState: { ...st.deviceState, [slot]: s } }));
      if (slot === 'trainer') {
        const t = demoFtp ? new DemoTrainer(demoFtp) : await FtmsTrainer.request();
        unsubs.trainer = [
          t.onState(onState),
          t.onData((d) =>
            set((st) => ({
              live: {
                ...st.live,
                // A separate power meter or HR strap wins over the trainer's own readings.
                ...(!st.pm && d.power !== undefined && { power: d.power }),
                ...(!st.pm && d.cadence !== undefined && { cadence: d.cadence }),
                ...(!st.hr && d.heartRate !== undefined && { heartRate: d.heartRate }),
                ...(d.speedKmh !== undefined && { speedKmh: d.speedKmh }),
              },
            })),
          ),
        ];
        set({ trainer: t, deviceState: { ...get().deviceState, trainer: 'connected' } });
      } else if (slot === 'hr') {
        const h = await BleHeartRate.request();
        unsubs.hr = [h.onState(onState), h.onHeartRate((bpm) => set((st) => ({ live: { ...st.live, heartRate: bpm } })))];
        set({ hr: h, deviceState: { ...get().deviceState, hr: 'connected' } });
      } else {
        const p = await BlePowerMeter.request();
        unsubs.pm = [
          p.onState(onState),
          p.onPower((d) => set((st) => ({ live: { ...st.live, power: d.power, ...(d.cadence !== undefined && { cadence: d.cadence }) } }))),
        ];
        set({ pm: p, deviceState: { ...get().deviceState, pm: 'connected' } });
      }
    } catch (err) {
      // Closing the browser's device picker is not an error worth showing.
      if (err instanceof DOMException && err.name === 'NotFoundError') return;
      set({ error: message(err) });
    }
  },

  disconnect(slot) {
    const device = slot === 'trainer' ? get().trainer : slot === 'hr' ? get().hr : get().pm;
    device?.disconnect();
    unsubs[slot]?.forEach((u) => u());
    delete unsubs[slot];
    set((st) => ({ [slot]: undefined, deviceState: { ...st.deviceState, [slot]: 'disconnected' } }));
  },

  load(workout, ftp, plannedDate) {
    const recording: Recording = {
      id: `ride-${Date.now().toString(36)}`, startedAt: Date.now(), workoutName: workout.name, plannedDate, ftp, workout, samples: [], finished: false,
    };
    set({ session: E.newSession(workout), recording, sentTarget: null, guard: { lowSeconds: 0, active: false }, upload: { status: 'idle' } });
  },

  resume(rec) {
    const last = rec.samples.at(-1);
    const session = { ...E.newSession(rec.workout), elapsed: last ? last.elapsed + 1 : 0, status: 'paused' as const };
    set({ session, recording: rec, sentTarget: null, upload: { status: 'idle' } });
    startTicker(get);
  },

  start() {
    const s = get().session;
    if (!s) return;
    set({ session: E.start(s) });
    startTicker(get);
  },
  pause() {
    const s = get().session;
    if (s) set({ session: E.pause(s) });
  },
  skip() {
    const s = get().session;
    if (s) set({ session: E.skip(s) });
  },
  extend() {
    const s = get().session;
    if (s) set({ session: E.extend(s) });
  },
  intensity(delta) {
    const s = get().session;
    if (s) set({ session: E.changeIntensity(s, delta) });
  },
  toggleErg() {
    const s = get().session;
    if (s) set({ session: E.toggleErg(s), sentTarget: null });
  },

  tick() {
    const { session, recording, trainer, live, guard, sentTarget } = get();
    if (!session || !recording) return;
    if (session.status !== 'running') return;

    const next = E.tick(session, 1);
    const g = E.updateCadenceGuard(guard, live.cadence);
    const desired = E.targetWatts(session, recording.ftp, g);
    const target = E.smoothTarget(sentTarget, desired);
    const erg = E.ergActive(session);
    if (trainer) {
      const p = erg ? trainer.setTargetPower(target) : trainer.setFreeRide();
      p.catch((err) => set({ error: `Trainer: ${message(err)}` }));
    }

    const sample: Sample = {
      t: Date.now(),
      elapsed: session.elapsed,
      segment: E.segmentIndexAt(session.segments, session.elapsed),
      target: erg ? target : undefined,
      ...live,
    };
    const samples = [...recording.samples, sample];
    const finished = next.status === 'finished';
    const rec = { ...recording, samples, finished };
    set({
      session: next,
      guard: g,
      sentTarget: target,
      recording: rec,
      recentPower: [...get().recentPower, live.power ?? 0].slice(-3),
    });
    if (finished) stopTicker();
    if (finished || samples.length % SAVE_EVERY_SAMPLES === 0) void db.rides.put(rec);
  },

  async finish() {
    const { recording, session } = get();
    stopTicker();
    if (!recording || !session) return;
    const rec = { ...recording, finished: true };
    set({ recording: rec, session: { ...session, status: 'finished' } });
    if (rec.samples.length) await db.rides.put(rec);
    else await db.rides.delete(rec.id);
  },

  async discard() {
    stopTicker();
    const rec = get().recording;
    if (rec) await db.rides.delete(rec.id);
    set({ session: undefined, recording: undefined, upload: { status: 'idle' } });
  },

  async uploadRide() {
    const rec = get().recording;
    const creds = await db.getMeta('credentials');
    if (!rec || !creds) return;
    set({ upload: { status: 'uploading' } });
    try {
      const pushed = rec.plannedDate ? await db.pushed.get(externalIdFor(rec.plannedDate)) : undefined;
      const encodeFit = await loadFit();
      const res = await new IntervalsClient(creds).uploadActivity(encodeFit(rec), `${rec.id}.fit`, {
        name: rec.workoutName,
        pairedEventId: pushed?.eventId,
      });
      const done = { ...rec, uploadedActivityId: res?.id ?? 'uploaded' };
      await db.rides.put(done);
      set({ recording: done, upload: { status: 'done', message: pushed ? 'Uploaded and linked to the planned workout.' : 'Uploaded.' } });
      void useSyncStore.getState().sync();
    } catch (err) {
      set({ upload: { status: 'error', message: message(err) } });
    }
  },

  async downloadFit() {
    const rec = get().recording;
    if (!rec) return;
    const encodeFit = await loadFit();
    const url = URL.createObjectURL(new Blob([encodeFit(rec) as BlobPart], { type: 'application/octet-stream' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: fitFilename(rec) });
    // The link must be in the document and the URL alive until the browser picks the download up.
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  },
}));

/** Browsers reject some characters in download names ("3 × 14 min" falls back to "download"). */
export function fitFilename(rec: Pick<Recording, 'startedAt' | 'workoutName'>): string {
  const name = rec.workoutName.replace(/×/g, 'x').replace(/[^A-Za-z0-9 ._-]/g, '').replace(/\s+/g, ' ').trim();
  return `${new Date(rec.startedAt).toISOString().slice(0, 10)} ${name || 'ride'}.fit`;
}

/** Unfinished rides left in the database (closed tab, crash). */
export async function unfinishedRide(): Promise<Recording | undefined> {
  const rides = await db.rides.orderBy('startedAt').reverse().toArray();
  return rides.find((r) => !r.finished && r.samples.length > 0);
}

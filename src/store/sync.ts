import { create } from 'zustand';
import { IntervalsClient, IntervalsError, type IntervalsCredentials } from '../integrations/intervals/client';
import { syncIntervals, type SyncResult } from '../integrations/intervals/sync';
import { toIsoDate } from '../lib/dates';
import { db } from './db';

/** Auto-sync on app start if the last sync is older than this. */
export const AUTO_SYNC_AFTER_MS = 60 * 60 * 1000;

interface SyncState {
  status: 'idle' | 'syncing' | 'error';
  error: string | null;
  lastResult: SyncResult | null;
  /** Verifies credentials against intervals.icu, stores them, then runs a first sync. */
  connect: (creds: IntervalsCredentials) => Promise<boolean>;
  sync: () => Promise<void>;
  autoSync: () => Promise<void>;
  disconnect: () => Promise<void>;
}

const message = (err: unknown) => (err instanceof Error ? err.message : String(err));

export const useSyncStore = create<SyncState>((set, get) => ({
  status: 'idle',
  error: null,
  lastResult: null,

  async connect(creds) {
    set({ status: 'syncing', error: null });
    try {
      const client = new IntervalsClient(creds);
      const athlete = await client.getAthlete();
      // A clean slate when switching athlete.
      const previous = await db.getMeta('credentials');
      if (previous && previous.athleteId !== athlete.id) await db.clearSynced();
      await db.setMeta('credentials', { athleteId: athlete.id, apiKey: creds.apiKey.trim() });
      set({ status: 'idle' });
      await get().sync();
      return get().status !== 'error';
    } catch (err) {
      set({ status: 'error', error: message(err) });
      return false;
    }
  },

  async sync() {
    if (get().status === 'syncing') return;
    const creds = await db.getMeta('credentials');
    if (!creds) return;
    set({ status: 'syncing', error: null });
    try {
      const result = await syncIntervals(db, new IntervalsClient(creds), toIsoDate(new Date()));
      set({ status: 'idle', lastResult: result });
    } catch (err) {
      const auth = err instanceof IntervalsError && err.isAuthError;
      set({ status: 'error', error: auth ? `${message(err)} (Settings → reconnect)` : message(err) });
    }
  },

  async autoSync() {
    if (get().status === 'syncing') return;
    const [creds, last] = await Promise.all([db.getMeta('credentials'), db.getMeta('lastSync')]);
    if (!creds) return;
    const age = last ? Date.now() - Date.parse(last.at) : Infinity;
    if (!(age < AUTO_SYNC_AFTER_MS)) await get().sync();
  },

  async disconnect() {
    await db.clearSynced();
    set({ status: 'idle', error: null, lastResult: null });
  },
}));

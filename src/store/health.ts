import { create } from 'zustand';
import type { DayAction } from '../engine/adjust';
import { EXTERNAL_PREFIX } from '../engine/push';
import { MIN_OPEN_SICK_DAYS, type Severity, type SicknessEpisode } from '../engine/sickness';
import { IntervalsClient } from '../integrations/intervals/client';
import type { IcuMarkerInput } from '../integrations/intervals/types';
import { addDays, toIsoDate, type IsoDate } from '../lib/dates';
import { db } from './db';

/** SICK/INJURED marker for intervals.icu (end exclusive). */
export function markerFor(ep: SicknessEpisode): IcuMarkerInput {
  const lastDay = ep.end ?? addDays(ep.start, MIN_OPEN_SICK_DAYS - 1);
  const injury = ep.kind === 'injury';
  return {
    category: injury ? 'INJURED' : 'SICK',
    start_date_local: `${ep.start}T00:00:00`,
    end_date_local: `${addDays(lastDay, 1)}T00:00:00`,
    name: injury ? 'Injured' : `Sick (${ep.severity})`,
    description: ep.end ? 'Marked in CyclingHub.' : 'Marked in CyclingHub. Still sick.',
    external_id: `${EXTERNAL_PREFIX}sick-${ep.id}`,
  };
}

interface HealthState {
  error: string | null;
  markSick: (severity: Severity, kind?: 'illness' | 'injury', start?: IsoDate) => Promise<void>;
  markBetter: (episodeId: string, today?: IsoDate) => Promise<void>;
  setDayAction: (date: IsoDate, action: DayAction | null) => Promise<void>;
}

/** Mirrors the episode to intervals.icu when connected; local state is the source of truth. */
async function pushMarker(ep: SicknessEpisode, set: (s: Partial<HealthState>) => void) {
  const creds = await db.getMeta('credentials');
  if (!creds) return;
  try {
    await new IntervalsClient(creds).createEventsBulk([markerFor(ep)]);
    set({ error: null });
  } catch (err) {
    set({ error: `Saved here, but not in intervals.icu: ${(err as Error).message}` });
  }
}

export const useHealthStore = create<HealthState>((set) => ({
  error: null,

  async markSick(severity, kind = 'illness', start = toIsoDate(new Date())) {
    const ep: SicknessEpisode = { id: `local-${Date.now().toString(36)}`, start, severity, source: 'local', kind };
    await db.sickness.put(ep);
    await pushMarker(ep, set);
  },

  async markBetter(episodeId, today = toIsoDate(new Date())) {
    const ep = await db.sickness.get(episodeId);
    if (!ep) return;
    // Better today means yesterday was the last sick day (but never before the start).
    const yesterday = addDays(today, -1);
    const updated = { ...ep, end: yesterday < ep.start ? ep.start : yesterday };
    await db.sickness.put(updated);
    await pushMarker(updated, set);
  },

  async setDayAction(date, action) {
    if (action) await db.dayActions.put({ date, action });
    else await db.dayActions.delete(date);
  },
}));

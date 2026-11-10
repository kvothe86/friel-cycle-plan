import Dexie, { type EntityTable } from 'dexie';
import type { IcuActivity, IcuAthlete, IcuEvent, IcuWellness } from '../integrations/intervals/types';
import type { AvailabilityOverride, AvailabilityTemplate, Goal, PlanSettings } from '../engine/types';
import type { PushedRecord } from '../engine/push';
import type { SicknessEpisode } from '../engine/sickness';
import type { DayActionRecord } from '../engine/adjust';
import type { PlanLogEntry } from '../engine/progression';
import type { Recording } from '../player/recording';
import type { IntervalsCredentials } from '../integrations/intervals/client';
import type { IsoDate } from '../lib/dates';

/** Activity as stored locally: the raw API record plus an indexed local date. */
export interface StoredActivity extends IcuActivity {
  date: IsoDate;
}

export interface SyncInfo {
  /** Last calendar day included in a successful sync. */
  date: IsoDate;
  /** Wall-clock time of that sync (ISO timestamp). */
  at: string;
}

interface MetaMap {
  credentials: IntervalsCredentials;
  athlete: IcuAthlete;
  lastSync: SyncInfo;
  availability: AvailabilityTemplate;
  planSettings: PlanSettings;
  pushSettings: PushSettings;
  lastPush: PushSummary;
}

export interface PushSettings {
  /** Push automatically whenever the plan changes. */
  auto: boolean;
}

export interface PushSummary {
  at: string;
  created: number;
  updated: number;
  deleted: number;
  userEdited: number;
  unchanged: number;
}

/** intervals.icu event as stored locally, with an indexed local start date. */
export interface StoredEvent extends IcuEvent {
  date: IsoDate;
}

export type MetaKey = keyof MetaMap;

interface MetaRow {
  key: MetaKey;
  value: unknown;
}

export class CyclingHubDb extends Dexie {
  meta!: EntityTable<MetaRow, 'key'>;
  wellness!: EntityTable<IcuWellness, 'id'>;
  activities!: EntityTable<StoredActivity, 'id'>;
  events!: EntityTable<StoredEvent, 'id'>;
  goals!: EntityTable<Goal, 'id'>;
  overrides!: EntityTable<AvailabilityOverride, 'date'>;
  pushed!: EntityTable<PushedRecord, 'externalId'>;
  sickness!: EntityTable<SicknessEpisode, 'id'>;
  dayActions!: EntityTable<DayActionRecord, 'date'>;
  planLog!: EntityTable<PlanLogEntry, 'date'>;
  rides!: EntityTable<Recording, 'id'>;

  constructor(name = 'cyclinghub') {
    super(name);
    this.version(1).stores({
      meta: '&key',
      wellness: '&id',
      activities: '&id, date',
    });
    this.version(2).stores({
      events: '&id, date, category',
      goals: '&id, date',
      overrides: '&date',
    });
    this.version(3).stores({ pushed: '&externalId, date' });
    this.version(4).stores({ sickness: '&id, start', dayActions: '&date', planLog: '&date' });
    this.version(5).stores({ rides: '&id, startedAt' });
  }

  async getMeta<K extends MetaKey>(key: K): Promise<MetaMap[K] | undefined> {
    const row = await this.meta.get(key);
    return row?.value as MetaMap[K] | undefined;
  }

  async setMeta<K extends MetaKey>(key: K, value: MetaMap[K]): Promise<void> {
    await this.meta.put({ key, value });
  }

  /** Removes intervals.icu credentials and everything synced from it; keeps local goals and availability. */
  async clearSynced(): Promise<void> {
    await this.transaction('rw', [this.meta, this.wellness, this.activities, this.events, this.goals, this.pushed], async () => {
      await Promise.all([
        this.meta.bulkDelete(['credentials', 'athlete', 'lastSync', 'lastPush']),
        this.pushed.clear(),
        this.wellness.clear(),
        this.activities.clear(),
        this.events.clear(),
        this.goals.where('id').startsWith('icu-').delete(),
      ]);
    });
  }

  /** Removes everything. */
  async clearAll(): Promise<void> {
    const tables = [this.meta, this.wellness, this.activities, this.events, this.goals, this.overrides, this.pushed, this.sickness, this.dayActions, this.planLog, this.rides];
    await this.transaction('rw', tables, async () => {
      await Promise.all(tables.map((t) => t.clear()));
    });
  }
}

export const db = new CyclingHubDb();

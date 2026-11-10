import Dexie, { type EntityTable } from 'dexie';
import type { IcuActivity, IcuAthlete, IcuWellness } from '../integrations/intervals/types';
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

  constructor(name = 'cyclinghub') {
    super(name);
    this.version(1).stores({
      meta: '&key',
      wellness: '&id',
      activities: '&id, date',
    });
  }

  async getMeta<K extends MetaKey>(key: K): Promise<MetaMap[K] | undefined> {
    const row = await this.meta.get(key);
    return row?.value as MetaMap[K] | undefined;
  }

  async setMeta<K extends MetaKey>(key: K, value: MetaMap[K]): Promise<void> {
    await this.meta.put({ key, value });
  }

  /** Removes everything: credentials and cached data. */
  async clearAll(): Promise<void> {
    await this.transaction('rw', this.meta, this.wellness, this.activities, async () => {
      await Promise.all([this.meta.clear(), this.wellness.clear(), this.activities.clear()]);
    });
  }
}

export const db = new CyclingHubDb();

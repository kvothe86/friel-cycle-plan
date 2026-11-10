import type { CyclingHubDb, MetaKey } from './db';

/**
 * Backup of everything that only lives in this browser. Data synced from
 * intervals.icu is left out (a sync restores it), and so are the
 * credentials: a backup file should be safe to keep anywhere.
 */

export const BACKUP_TABLES = ['goals', 'overrides', 'sickness', 'dayActions', 'planLog', 'pushed', 'rides'] as const;
export const BACKUP_META: MetaKey[] = ['availability', 'planSettings', 'pushSettings', 'ftp', 'ftpTestSnoozedUntil', 'onboardingDismissed'];

type Table = (typeof BACKUP_TABLES)[number];

export interface Backup {
  app: 'cyclinghub';
  version: 1;
  exportedAt: string;
  meta: Partial<Record<MetaKey, unknown>>;
  tables: Record<Table, unknown[]>;
}

export async function exportBackup(db: CyclingHubDb, now = new Date()): Promise<Backup> {
  const tables = Object.fromEntries(await Promise.all(BACKUP_TABLES.map(async (t) => [t, await db[t].toArray()]))) as Backup['tables'];
  const meta: Backup['meta'] = {};
  for (const key of BACKUP_META) {
    const v = await db.getMeta(key);
    if (v !== undefined) meta[key] = v;
  }
  return { app: 'cyclinghub', version: 1, exportedAt: now.toISOString(), meta, tables };
}

export function parseBackup(text: string): Backup {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Not a CyclingHub backup: the file is not valid JSON.');
  }
  const b = data as Partial<Backup>;
  if (b?.app !== 'cyclinghub' || b.version !== 1 || typeof b.tables !== 'object' || !b.tables) {
    throw new Error('Not a CyclingHub backup (or from an unsupported version).');
  }
  for (const t of BACKUP_TABLES) if (b.tables[t] !== undefined && !Array.isArray(b.tables[t])) throw new Error(`Backup is damaged: "${t}" is not a list.`);
  return b as Backup;
}

/** Replaces the local (non-synced) data with the backup's. Credentials and synced data are untouched. */
export async function importBackup(db: CyclingHubDb, backup: Backup): Promise<void> {
  await db.transaction('rw', [db.meta, ...BACKUP_TABLES.map((t) => db[t])], async () => {
    for (const t of BACKUP_TABLES) {
      await db[t].clear();
      // Each table's own schema validates its rows on put.
      await (db[t] as unknown as { bulkPut: (rows: unknown[]) => Promise<unknown> }).bulkPut(backup.tables[t] ?? []);
    }
    for (const key of BACKUP_META) {
      if (key in backup.meta) await db.meta.put({ key, value: backup.meta[key] });
      else await db.meta.delete(key);
    }
  });
}

import { CyclingHubDb } from './db';
import { exportBackup, importBackup, parseBackup } from './backup';

describe('backup', () => {
  it('round-trips local data and leaves credentials and synced data alone', async () => {
    const a = new CyclingHubDb(`bk-a-${Math.random()}`);
    await a.setMeta('credentials', { athleteId: 'i1', apiKey: 'secret' });
    await a.setMeta('planSettings', { experience: 'advanced', cycleWeeks: 3 });
    await a.goals.put({ id: 'g', kind: 'event', name: 'Race', date: '2027-04-18', priority: 'A', specialty: 'climbing', source: 'local' });
    await a.sickness.put({ id: 's', start: '2026-11-01', end: '2026-11-03', severity: 'mild', source: 'local' });
    await a.wellness.put({ id: '2026-11-10', ctl: 50 });

    const backup = await exportBackup(a);
    const text = JSON.stringify(backup);
    expect(text).not.toContain('secret');
    expect(backup.tables.goals).toHaveLength(1);

    const b = new CyclingHubDb(`bk-b-${Math.random()}`);
    await b.setMeta('credentials', { athleteId: 'i2', apiKey: 'other' });
    await b.goals.put({ id: 'old', kind: 'specialty', name: 'Old', priority: 'A', specialty: 'tt', source: 'local' });
    await b.wellness.put({ id: '2026-11-09', ctl: 40 });
    await importBackup(b, parseBackup(text));

    expect((await b.goals.toArray()).map((g) => g.id)).toEqual(['g']);
    expect(await b.sickness.count()).toBe(1);
    expect(await b.getMeta('planSettings')).toEqual({ experience: 'advanced', cycleWeeks: 3 });
    expect(await b.getMeta('credentials')).toEqual({ athleteId: 'i2', apiKey: 'other' });
    expect(await b.wellness.count()).toBe(1);
    await a.delete();
    await b.delete();
  });

  it('rejects files that are not a backup', () => {
    expect(() => parseBackup('nope')).toThrow(/not valid JSON/);
    expect(() => parseBackup('{"app":"other"}')).toThrow(/Not a CyclingHub backup/);
    expect(() => parseBackup('{"app":"cyclinghub","version":1,"tables":{"goals":"x"}}')).toThrow(/damaged/);
  });
});

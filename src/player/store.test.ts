import { buildWorkout } from '../engine/library';
import { externalIdFor } from '../engine/push';
import { db } from '../store/db';
import { totalSeconds } from './engine';
import { fitFilename, unfinishedRide, usePlayerStore } from './store';

const workout = buildWorkout('vo2', 40, { level: 4, specialty: 'allround', outdoor: false });

describe('player store with the demo trainer', () => {
  beforeEach(async () => {
    await db.clearAll();
    // Only the 1 Hz tickers and the clock: IndexedDB (fake-indexeddb) needs real timeouts.
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
    usePlayerStore.setState({ session: undefined, recording: undefined, trainer: undefined, live: {}, recentPower: [], sentTarget: null, upload: { status: 'idle' } });
  });
  afterEach(() => {
    usePlayerStore.getState().disconnect('trainer');
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('rides a workout end to end: targets, recording, autosave, finish, upload linked to the plan', async () => {
    const st = usePlayerStore.getState();
    await st.connect('trainer', 250);
    const trainer = usePlayerStore.getState().trainer!;
    const setTarget = vi.spyOn(trainer, 'setTargetPower');

    usePlayerStore.getState().load(workout, 250, '2026-11-12');
    usePlayerStore.getState().start();

    // 20 s in: ERG targets follow the warm-up ramp (50 % → 75 % of 250 W), eased.
    await vi.advanceTimersByTimeAsync(20_000);
    const s1 = usePlayerStore.getState();
    expect(s1.recording!.samples).toHaveLength(20);
    expect(setTarget).toHaveBeenCalled();
    const lastTarget = setTarget.mock.calls.at(-1)![0];
    expect(lastTarget).toBeGreaterThan(120);
    expect(lastTarget).toBeLessThan(140);
    expect(s1.recording!.samples.at(-1)!.power).toBeGreaterThan(0);
    // Autosaved every 10 samples for crash recovery.
    expect((await unfinishedRide())?.samples).toHaveLength(20);

    // Pause stops time and recording.
    usePlayerStore.getState().pause();
    await vi.advanceTimersByTimeAsync(5_000);
    expect(usePlayerStore.getState().recording!.samples).toHaveLength(20);

    // Ride to the end.
    usePlayerStore.getState().start();
    await vi.advanceTimersByTimeAsync(totalSeconds(usePlayerStore.getState().session!) * 1000);
    const done = usePlayerStore.getState();
    expect(done.session!.status).toBe('finished');
    expect(done.recording!.finished).toBe(true);
    expect(await unfinishedRide()).toBeUndefined();

    // Upload: FIT as multipart, paired with the pushed workout of that day.
    await db.setMeta('credentials', { athleteId: 'i1', apiKey: 'k' });
    await db.pushed.put({ externalId: externalIdFor('2026-11-12'), date: '2026-11-12', eventId: 777, hash: 'x' });
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: 'i555' })));
    vi.stubGlobal('fetch', fetchMock);
    await usePlayerStore.getState().uploadRide();
    expect(usePlayerStore.getState().upload.status).toBe('done');
    const url = String((fetchMock.mock.calls[0] as unknown as [string])[0]);
    expect(url).toContain('/activities?');
    expect(url).toContain('paired_event_id=777');
    expect((await db.rides.toArray())[0]!.uploadedActivityId).toBe('i555');
  });
});

describe('fitFilename', () => {
  it('produces names browsers accept', () => {
    expect(fitFilename({ startedAt: Date.UTC(2026, 10, 10, 18), workoutName: 'Sweet spot 3 × 14 min' })).toBe('2026-11-10 Sweet spot 3 x 14 min.fit');
    expect(fitFilename({ startedAt: Date.UTC(2026, 10, 10, 18), workoutName: '30/30s 2 × 8' })).toBe('2026-11-10 3030s 2 x 8.fit');
  });
});

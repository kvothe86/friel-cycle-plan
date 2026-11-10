import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { App } from '../App';
import { addDays, toIsoDate } from '../lib/dates';
import { db } from '../store/db';
import { markerFor } from '../store/health';

const today = toIsoDate(new Date());

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

describe('sickness mode and day actions', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(async () => {
    await db.clearAll();
    await db.setMeta('credentials', { athleteId: 'i1', apiKey: 'k' });
    await db.setMeta('lastSync', { date: today, at: new Date().toISOString() });
    await db.wellness.put({ id: today, ctl: 50, atl: 50 });
    // 60 min every day, so today always has a session.
    await db.setMeta('availability', Array.from({ length: 7 }, () => ({ minutes: 60, mode: 'indoor' as const })) as never);
    fetchMock = vi.fn(async (_url: string, init?: RequestInit) => new Response(init?.body ?? '[]'));
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('marks sick → rest + SICK marker in intervals.icu → better → re-entry', async () => {
    const view = renderAt('/today');
    fireEvent.click(await screen.findByRole('button', { name: "I'm sick / injured" }));
    fireEvent.click(screen.getByRole('button', { name: 'Mark from today' }));

    expect(await screen.findByText(/Sick \(day 1\): rest/, { selector: '.adjustment' })).toBeInTheDocument();
    const ep = (await db.sickness.toArray())[0]!;
    expect(ep).toMatchObject({ start: today, severity: 'mild' });
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/events\/bulk\?upsert=true$/);
    expect(JSON.parse(init.body as string)[0]).toMatchObject({ category: 'SICK', external_id: `cyclinghub-sick-${ep.id}`, end_date_local: `${addDays(today, 3)}T00:00:00` });
    view.unmount();

    // 14 days: three rest days (still sick), then re-entry endurance.
    const plan = renderAt('/plan');
    const cards = (await screen.findByRole('list', { name: 'Plan horizon' })).querySelectorAll(':scope > li');
    expect([...cards].slice(0, 3).every((c) => c.classList.contains('kind-rest'))).toBe(true);
    expect(cards[3]).toHaveTextContent(/Endurance/);
    plan.unmount();

    renderAt('/today');
    fireEvent.click(await screen.findByRole('button', { name: "I'm better" }));
    await waitFor(async () => expect((await db.sickness.get(ep.id))?.end).toBe(today));
  });

  it('skip, then undo', async () => {
    renderAt('/today');
    const skip = await screen.findByRole('button', { name: 'Skip' });
    fireEvent.click(skip);
    expect(await screen.findByText(/Skipped by you/, { selector: '.adjustment' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(screen.queryByText(/Skipped by you/, { selector: '.adjustment' })).not.toBeInTheDocument());
    expect(await db.dayActions.count()).toBe(0);
  });
});

describe('markerFor', () => {
  it('uses an exclusive end and INJURED for injuries', () => {
    expect(markerFor({ id: 'x', start: '2026-11-20', end: '2026-11-22', severity: 'severe', source: 'local', kind: 'injury' })).toMatchObject({
      category: 'INJURED', start_date_local: '2026-11-20T00:00:00', end_date_local: '2026-11-23T00:00:00',
    });
  });
});

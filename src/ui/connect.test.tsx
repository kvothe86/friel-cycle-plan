import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { App } from '../App';
import { addDays, dateRange, toIsoDate } from '../lib/dates';
import { db } from '../store/db';
import { useSyncStore } from '../store/sync';

const today = toIsoDate(new Date());
const wellness = dateRange(addDays(today, -59), 60).map((id, i) => ({
  id,
  ctl: 55 + i * 0.05,
  atl: 60,
  hrv: i % 2 ? 62 : 58,
  restingHR: i % 2 ? 49 : 51,
  sleepSecs: 7.5 * 3600,
}));

function mockIntervals(status = 200) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    if (status !== 200) return new Response('{}', { status });
    const body = url.pathname.endsWith('/events')
      ? []
      : url.pathname.endsWith('/wellness')
      ? wellness
      : url.pathname.endsWith('/activities')
        ? [{ id: 'r1', start_date_local: `${today}T07:00:00`, type: 'Run', name: 'Morning run', icu_training_load: 35, moving_time: 2400 }]
        : { id: 'i777', name: 'Test Rider', sportSettings: [{ types: ['Ride'], ftp: 280 }] };
    return new Response(JSON.stringify(body), { status: 200 });
  });
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

async function connect() {
  fireEvent.change(screen.getByLabelText('Athlete ID'), { target: { value: '777' } });
  fireEvent.change(screen.getByLabelText('API key'), { target: { value: 'key' } });
  fireEvent.click(screen.getByRole('button', { name: 'Connect & sync' }));
}

describe('connect flow', () => {
  beforeEach(async () => {
    await db.clearAll();
    useSyncStore.setState({ status: 'idle', error: null, lastResult: null });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('connects, syncs and shows athlete, readiness and other-sport load', async () => {
    vi.stubGlobal('fetch', mockIntervals());
    const { unmount } = renderAt('/settings');
    await connect();

    expect(await screen.findByText(/Test Rider/)).toBeInTheDocument();
    expect(screen.getAllByText('280 W').length).toBeGreaterThan(0); // FTP card
    expect(await db.getMeta('credentials')).toEqual({ athleteId: 'i777', apiKey: 'key' });
    unmount();

    renderAt('/today');
    await waitFor(() => expect(screen.getByText(/^(High|Normal)$/)).toBeInTheDocument());
    expect(screen.getByText('62 ms')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('link', { name: 'History' }));
    expect(await screen.findByText('Morning run')).toBeInTheDocument();
    expect(screen.getByText(/35 other sports/)).toBeInTheDocument();
  });

  it('shows a clear error for a wrong API key and stores nothing', async () => {
    vi.stubGlobal('fetch', mockIntervals(401));
    renderAt('/settings');
    await connect();
    expect(await screen.findByRole('alert')).toHaveTextContent(/API key/);
    expect(await db.getMeta('credentials')).toBeUndefined();
  });
});

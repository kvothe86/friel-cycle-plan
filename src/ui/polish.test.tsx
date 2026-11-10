import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import { GettingStarted } from './components/GettingStarted';
import { db } from '../store/db';
import { DEFAULT_AVAILABILITY } from '../engine/types';

function Boom(): never {
  throw new Error('kaboom');
}

describe('ErrorBoundary', () => {
  it('shows the error with reload and backup instead of a blank screen', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('kaboom');
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download a backup' })).toBeInTheDocument();
    spy.mockRestore();
  });
});

describe('GettingStarted', () => {
  beforeEach(async () => {
    await db.clearAll();
  });

  it('lists the setup steps and disappears once the required ones are done', async () => {
    const view = render(
      <MemoryRouter>
        <GettingStarted />
      </MemoryRouter>,
    );
    expect(await screen.findByText('Getting started')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Connect intervals.icu' })).toBeInTheDocument();

    await db.setMeta('credentials', { athleteId: 'i1', apiKey: 'k' });
    await db.setMeta('availability', DEFAULT_AVAILABILITY);
    await db.goals.put({ id: 'g', kind: 'specialty', name: 'Climb', priority: 'A', specialty: 'climbing', source: 'local' });
    await waitFor(() => expect(screen.queryByText('Getting started')).not.toBeInTheDocument());
    view.unmount();
  });
});

describe('FTP test result in the ride summary', () => {
  it('shows the estimate and saves it as FTP', async () => {
    const { RideSummary } = await import('./player/RideSummary');
    const { usePlayerStore } = await import('../player/store');
    const { buildWorkout } = await import('../engine/library');
    const { fireEvent } = await import('@testing-library/react');
    await db.clearAll();
    const t0 = Date.UTC(2026, 10, 10, 18);
    const powers = [...Array(300).fill(130), ...Array(15 * 60).fill(250), ...Array(60).fill(400)];
    usePlayerStore.setState({
      recording: {
        id: 'r', startedAt: t0, workoutName: 'FTP ramp test', ftp: 280, finished: true,
        workout: buildWorkout('ftp_test', 40, { level: 4, specialty: 'allround', outdoor: false }, 0),
        samples: powers.map((p, i) => ({ t: t0 + i * 1000, elapsed: i, power: p, segment: 0 })),
      },
    });
    render(<RideSummary connected={false} />);
    expect(await screen.findByText('300 W')).toBeInTheDocument();
    expect(screen.getByText(/was 280 W \(\+20 W\)/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Use 300 W as my FTP' }));
    await waitFor(async () => expect(await db.getMeta('ftp')).toEqual({ watts: 300, date: '2026-11-10', source: 'ramp' }));
    expect(await screen.findByRole('button', { name: 'Set as your FTP ✓' })).toBeDisabled();
  });
});

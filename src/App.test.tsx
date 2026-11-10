import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { App } from './App';
import { toIsoDate } from './lib/dates';
import { db } from './store/db';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

describe('App shell', () => {
  it('redirects / to Today', () => {
    renderAt('/');
    expect(screen.getByRole('heading', { name: 'Today' })).toBeInTheDocument();
  });

  it('shows all main navigation entries', () => {
    renderAt('/today');
    const nav = screen.getByRole('navigation', { name: 'Main' });
    for (const label of ['Today', '14 days', 'Season', 'History', 'Goals', 'Ride', 'Guide', 'Settings']) {
      expect(nav).toHaveTextContent(label);
    }
  });

  it('renders a 14-day horizon with only today committed', async () => {
    const today = toIsoDate(new Date());
    await db.setMeta('credentials', { athleteId: 'i1', apiKey: 'k' });
    await db.setMeta('lastSync', { date: today, at: new Date().toISOString() });
    renderAt('/plan');
    const list = await screen.findByRole('list', { name: 'Plan horizon' });
    const items = list.querySelectorAll(':scope > li');
    expect(items).toHaveLength(14);
    expect(items[0]).toHaveClass('committed');
    expect(items[1]).toHaveClass('tentative');
    expect(screen.getByText(/^Why:/)).toBeInTheDocument();
    await db.clearAll();
  });
});

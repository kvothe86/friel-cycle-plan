import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { App } from '../App';
import { addDays, startOfWeek, toIsoDate } from '../lib/dates';
import { db } from '../store/db';

const today = toIsoDate(new Date());

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

describe('goals & season flow', () => {
  beforeEach(async () => {
    await db.clearAll();
    // Connected state without network: credentials and a fresh sync marker.
    await db.setMeta('credentials', { athleteId: 'i1', apiKey: 'k' });
    await db.setMeta('lastSync', { date: today, at: new Date().toISOString() });
    await db.wellness.put({ id: today, ctl: 50, atl: 50 });
  });

  it('adds an event goal, saves availability and an override, and plans the season', async () => {
    const view = renderAt('/goals');
    const raceDate = addDays(today, 20 * 7);

    // Add an A event
    const form = await screen.findByRole('form', { name: 'Add goal' });
    fireEvent.change(within(form).getByLabelText('Goal name'), { target: { value: 'Spring Classic' } });
    fireEvent.change(within(form).getByLabelText('Goal date'), { target: { value: raceDate } });
    fireEvent.change(within(form).getByLabelText('Event type'), { target: { value: 'hill_climb' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Add goal' }));
    expect(await screen.findByText('Spring Classic')).toBeInTheDocument();
    expect((await db.goals.toArray())[0]).toMatchObject({ specialty: 'climbing', priority: 'A', date: raceDate });

    // Save a week with 2 h on Saturday
    expect(screen.getByText(/Using a default week/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Saturday minutes'), { target: { value: '240' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save week' }));
    await waitFor(async () => expect((await db.getMeta('availability'))?.[5].minutes).toBe(240));

    // Block next Monday–Sunday
    const monday = addDays(startOfWeek(today), 7);
    const ov = screen.getByRole('form', { name: 'Add override' });
    fireEvent.change(within(ov).getByLabelText('Override from'), { target: { value: monday } });
    fireEvent.change(within(ov).getByLabelText('Override to'), { target: { value: addDays(monday, 6) } });
    fireEvent.click(within(ov).getByRole('button', { name: 'Add' }));
    await waitFor(async () => expect(await db.overrides.count()).toBe(7));
    view.unmount();

    // Season shows the goal, phases and the blocked week
    renderAt('/season');
    expect(await screen.findByText('Spring Classic')).toBeInTheDocument();
    const rows = within(screen.getAllByRole('table')[0]!).getAllByRole('row').slice(1);
    expect(rows.length).toBe(21);
    expect(rows.at(-1)).toHaveTextContent('Race');
    const blocked = rows.find((r) => r.textContent?.startsWith(monday))!;
    expect(blocked).toHaveTextContent('none');
    expect(screen.queryByText(/default week/)).not.toBeInTheDocument();
  });
});

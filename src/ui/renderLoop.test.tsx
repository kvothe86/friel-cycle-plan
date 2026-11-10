import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { App } from '../App';
import { toIsoDate } from '../lib/dates';
import { db } from '../store/db';

/** Regression: PlanLogger once re-wrote today's entry on every render, looping through the live queries. */
describe('no render/write loop', () => {
  it('writes today’s plan log at most once and settles', async () => {
    const today = toIsoDate(new Date());
    await db.clearAll();
    await db.setMeta('credentials', { athleteId: 'i1', apiKey: 'k' });
    await db.setMeta('lastSync', { date: today, at: new Date().toISOString() });
    await db.wellness.put({ id: today, ctl: 50, atl: 50 });
    await db.setMeta('availability', Array.from({ length: 7 }, () => ({ minutes: 60, mode: 'indoor' as const })) as never);

    const put = vi.spyOn(db.planLog, 'put');
    render(
      <MemoryRouter initialEntries={['/today']}>
        <App />
      </MemoryRouter>,
    );
    await screen.findByText("Today's session");
    await new Promise((r) => setTimeout(r, 1500));
    expect(put.mock.calls.length).toBeLessThanOrEqual(1);
    expect(await db.planLog.count()).toBe(1);
    put.mockRestore();
  });
});

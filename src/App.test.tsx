import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { App } from './App';

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
    for (const label of ['Today', '14 days', 'Season', 'Goals', 'Ride', 'Settings']) {
      expect(nav).toHaveTextContent(label);
    }
  });

  it('renders a 14-day horizon with only today committed', () => {
    renderAt('/plan');
    const items = screen.getByRole('list', { name: 'Plan horizon' }).querySelectorAll('li');
    expect(items).toHaveLength(14);
    expect(items[0]).toHaveClass('committed');
    expect(items[1]).toHaveClass('tentative');
  });
});

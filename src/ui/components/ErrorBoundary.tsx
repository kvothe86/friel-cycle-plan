import { Component, type ErrorInfo, type ReactNode } from 'react';
import { exportBackup } from '../../store/backup';
import { db } from '../../store/db';

interface State {
  error: Error | null;
}

/** Shows what went wrong (and a way to save data) instead of a blank screen. */
export class ErrorBoundary extends Component<{ children: ReactNode; resetKey?: string }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('CyclingHub crashed', error, info.componentStack);
  }

  componentDidUpdate(prev: { resetKey?: string }) {
    // Navigating to another screen clears the error.
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  private backup = async () => {
    const data = await exportBackup(db);
    const url = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: 'cyclinghub-backup.json' });
    document.body.append(a);
    a.click();
    a.remove();
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <section className="card crash" role="alert">
        <h1>Something went wrong on this screen</h1>
        <p className="muted">{this.state.error.message}</p>
        <div className="actions">
          <button type="button" className="primary" onClick={() => window.location.reload()}>Reload</button>
          <button type="button" onClick={() => void this.backup()}>Download a backup</button>
        </div>
        <p className="muted small">Your data is stored in this browser and is not lost by reloading. Other screens keep working.</p>
      </section>
    );
  }
}

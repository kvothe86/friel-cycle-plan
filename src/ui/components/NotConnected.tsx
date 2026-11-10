import { Link } from 'react-router-dom';

export function NotConnected() {
  return (
    <div className="card">
      <p>No data yet. <Link to="/settings">Connect intervals.icu</Link> to pull your fitness, wellness and activities.</p>
    </div>
  );
}

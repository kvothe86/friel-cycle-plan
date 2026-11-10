import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { db } from '../../store/db';
import { useAvailability, useCredentials, useGoals, useLastPush } from '../../store/hooks';

/** First-run checklist on Today, until the basics are done (or dismissed). */
export function GettingStarted() {
  const creds = useCredentials();
  const availability = useAvailability();
  const goals = useGoals();
  const lastPush = useLastPush();
  const rides = useLiveQuery(() => db.rides.count(), [], 0);
  const dismissed = useLiveQuery(() => db.getMeta('onboardingDismissed'), [], undefined);

  const steps = [
    { done: !!creds, label: 'Connect intervals.icu', to: '/settings', required: true },
    { done: !!availability && !availability.isDefault, label: 'Set your weekly availability', to: '/goals', required: true },
    { done: goals.length > 0, label: 'Add a goal (event, specialty or target)', to: '/goals', required: true },
    { done: !!lastPush, label: 'Send your plan to intervals.icu (optional)', to: '/plan', required: false },
    { done: rides > 0, label: 'Ride a session on your trainer (optional)', to: '/player', required: false },
  ];
  if (dismissed || steps.filter((s) => s.required).every((s) => s.done)) return null;

  return (
    <div className="card getting-started">
      <h2>Getting started</h2>
      <table className="table compact">
        <tbody>
          {steps.map((s) => (
            <tr key={s.label}>
              <td className="check-cell">{s.done ? '✅' : '❌'}</td>
              <td>{s.done ? s.label : <Link to={s.to}>{s.label}</Link>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" className="small-btn" onClick={() => void db.setMeta('onboardingDismissed', true)}>Hide</button>
    </div>
  );
}

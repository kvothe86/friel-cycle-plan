import { useState, type FormEvent } from 'react';
import { daysBetween, dateRange, weekdayShort } from '../../lib/dates';
import { db } from '../../store/db';
import { useBlockedRanges, useOverrides, useToday } from '../../store/hooks';
import type { RideMode } from '../../engine/types';
import { MODE_LABELS } from './labels';

export function OverridesCard() {
  const today = useToday();
  const overrides = useOverrides().filter((o) => o.date >= today);
  const holidays = useBlockedRanges().filter((b) => b.end >= today);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [minutes, setMinutes] = useState('0');
  const [mode, setMode] = useState<RideMode>('any');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const end = to || from;
    const days = daysBetween(from, end) + 1;
    if (days < 1 || days > 60) {
      setError('Pick an end date on or after the start, at most 60 days.');
      return;
    }
    setError(null);
    await db.overrides.bulkPut(dateRange(from, days).map((date) => ({ date, minutes: Math.max(0, Number(minutes) || 0), mode, ...(note.trim() && { note: note.trim() }) })));
    setFrom('');
    setTo('');
    setNote('');
  };

  return (
    <div className="card">
      <h2>Date overrides</h2>
      <p className="muted small">Holidays, short days or a long weekend ride. Overrides beat the weekly template.</p>
      {holidays.length > 0 && (
        <ul className="plain">
          {holidays.map((h) => (
            <li key={`${h.start}-${h.end}`}>
              <span className="tag">intervals.icu</span> {h.start}{h.end !== h.start && ` → ${h.end}`}: {h.reason} (no training)
            </li>
          ))}
        </ul>
      )}
      {overrides.length > 0 && (
        <table className="table compact">
          <tbody>
            {overrides.map((o) => (
              <tr key={o.date}>
                <td>{weekdayShort(o.date)} {o.date}</td>
                <td>{o.minutes === 0 ? 'no training' : `${o.minutes} min`}</td>
                <td>{o.minutes > 0 ? MODE_LABELS[o.mode] : ''}</td>
                <td className="muted">{o.note}</td>
                <td className="num">
                  <button type="button" className="danger small-btn" onClick={() => void db.overrides.delete(o.date)}>Remove</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <form className="inline-form" onSubmit={(e) => void onSubmit(e)} aria-label="Add override">
        <input aria-label="Override from" type="date" min={today} value={from} onChange={(e) => setFrom(e.target.value)} required />
        <input aria-label="Override to" type="date" min={from || today} value={to} onChange={(e) => setTo(e.target.value)} />
        <input aria-label="Override minutes" type="number" min={0} max={600} step={15} className="narrow" value={minutes} onChange={(e) => setMinutes(e.target.value)} />
        <select aria-label="Override mode" value={mode} onChange={(e) => setMode(e.target.value as RideMode)}>
          {Object.entries(MODE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <input aria-label="Override note" placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
        <button type="submit">Add</button>
      </form>
      {error && <p className="error" role="alert">{error}</p>}
    </div>
  );
}

import { useState, type FormEvent } from 'react';
import { db } from '../../store/db';
import { useGoals, useToday } from '../../store/hooks';
import {
  EVENT_SPECIALTY, EVENT_TYPE_LABELS, SPECIALTY_LABELS,
  type EventType, type Goal, type GoalKind, type Priority, type Specialty, type TargetMetric,
} from '../../engine/types';

const KIND_LABELS: Record<GoalKind, string> = { event: 'Event', specialty: 'Specialty', target: 'Target' };

function newId() {
  return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function describe(g: Goal): string {
  if (g.kind === 'event') return g.eventType ? EVENT_TYPE_LABELS[g.eventType] : 'Event';
  if (g.kind === 'target' && g.target) return `${g.target.metric.toUpperCase()} ${g.target.value}${g.target.metric === 'ftp' ? ' W' : ''}`;
  return 'Specialty focus';
}

export function GoalsCard() {
  const today = useToday();
  const goals = useGoals();
  const sorted = [...goals].sort((a, b) => (a.date ?? '9999') < (b.date ?? '9999') ? -1 : 1);
  const update = (id: string, patch: Partial<Goal>) => void db.goals.update(id, patch);

  return (
    <div className="card">
      <h2>Goals</h2>
      {sorted.length === 0 ? (
        <p className="muted">No goals yet. Without a goal the plan rolls 16-week all-round blocks.</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Goal</th><th>Kind</th><th>Date</th><th>Prio</th><th>Event type</th><th>Specialty</th><th />
            </tr>
          </thead>
          <tbody>
            {sorted.map((g) => (
              <tr key={g.id} className={g.date && g.date < today ? 'past' : ''}>
                <td>
                  {g.name} {g.source === 'intervals' && <span className="tag">intervals.icu</span>}
                </td>
                <td>{KIND_LABELS[g.kind]} <span className="muted small">{describe(g)}</span></td>
                <td>{g.date ?? '–'}</td>
                <td><span className={`prio prio-${g.priority}`}>{g.priority}</span></td>
                <td>
                  {g.kind === 'event' ? (
                    <select
                      aria-label={`Event type for ${g.name}`}
                      value={g.eventType ?? 'road_race'}
                      onChange={(e) => {
                        const eventType = e.target.value as EventType;
                        update(g.id, { eventType, specialty: EVENT_SPECIALTY[eventType] });
                      }}
                    >
                      {Object.entries(EVENT_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  ) : '–'}
                </td>
                <td>
                  <select
                    aria-label={`Specialty for ${g.name}`}
                    value={g.specialty}
                    onChange={(e) => update(g.id, { specialty: e.target.value as Specialty })}
                  >
                    {Object.entries(SPECIALTY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </td>
                <td className="num">
                  {g.source === 'local' ? (
                    <button type="button" className="danger small-btn" onClick={() => void db.goals.delete(g.id)}>Delete</button>
                  ) : (
                    <span className="muted small" title="Edit or delete this race in intervals.icu">synced</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <AddGoalForm today={today} />
    </div>
  );
}

function AddGoalForm({ today }: { today: string }) {
  const [kind, setKind] = useState<GoalKind>('event');
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [priority, setPriority] = useState<Priority>('A');
  const [eventType, setEventType] = useState<EventType>('road_race');
  const [specialty, setSpecialty] = useState<Specialty>('allround');
  const [metric, setMetric] = useState<TargetMetric>('ftp');
  const [value, setValue] = useState('');

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const goal: Goal = {
      id: newId(),
      kind,
      name: name.trim() || (kind === 'target' ? `${metric.toUpperCase()} ${value}` : SPECIALTY_LABELS[specialty]),
      priority: kind === 'specialty' ? 'A' : priority,
      specialty: kind === 'event' ? EVENT_SPECIALTY[eventType] : specialty,
      source: 'local',
      ...(kind !== 'specialty' && { date }),
      ...(kind === 'event' && { eventType }),
      ...(kind === 'target' && { target: { metric, value: Number(value) } }),
    };
    await db.goals.put(goal);
    setName('');
    setDate('');
    setValue('');
  };

  return (
    <form className="inline-form" onSubmit={(e) => void onSubmit(e)} aria-label="Add goal">
      <select aria-label="Goal kind" value={kind} onChange={(e) => setKind(e.target.value as GoalKind)}>
        <option value="event">Event</option>
        <option value="specialty">Specialty (no date)</option>
        <option value="target">Target metric by date</option>
      </select>
      <input aria-label="Goal name" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
      {kind !== 'specialty' && (
        <input aria-label="Goal date" type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} required />
      )}
      {kind === 'event' && (
        <select aria-label="Event type" value={eventType} onChange={(e) => setEventType(e.target.value as EventType)}>
          {Object.entries(EVENT_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      )}
      {kind === 'target' && (
        <>
          <select aria-label="Target metric" value={metric} onChange={(e) => setMetric(e.target.value as TargetMetric)}>
            <option value="ftp">FTP (W)</option>
            <option value="ctl">CTL</option>
          </select>
          <input aria-label="Target value" type="number" min={1} value={value} onChange={(e) => setValue(e.target.value)} required className="narrow" />
        </>
      )}
      {kind !== 'event' && (
        <select aria-label="Specialty" value={specialty} onChange={(e) => setSpecialty(e.target.value as Specialty)}>
          {Object.entries(SPECIALTY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      )}
      {kind !== 'specialty' && (
        <select aria-label="Priority" value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
          <option value="A">A: main goal</option>
          <option value="B">B: mini-taper</option>
          <option value="C">C: train through</option>
        </select>
      )}
      <button type="submit">Add goal</button>
    </form>
  );
}

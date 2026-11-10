import { useState } from 'react';
import { healthStatus, type Severity } from '../../engine/sickness';
import { useSicknessEpisodes, useToday } from '../../store/hooks';
import { useHealthStore } from '../../store/health';

const STAGE_TEXT = {
  sick: 'Sick',
  'symptom-free': 'Symptom-free, still resting',
  reentry: 'Return to training: re-entry',
  reload: 'Return to training: reload',
} as const;

export function HealthCard() {
  const today = useToday();
  const episodes = useSicknessEpisodes();
  const { markSick, markBetter, error } = useHealthStore();
  const [open, setOpen] = useState(false);
  const [severity, setSeverity] = useState<Severity>('mild');
  const [kind, setKind] = useState<'illness' | 'injury'>('illness');
  const status = healthStatus(today, episodes, today);
  const ep = status?.episode;

  return (
    <div className="card health">
      <h2>Health</h2>
      {status && ep ? (
        <>
          <div className="big-text">{STAGE_TEXT[status.stage]}</div>
          <p className="muted">
            {ep.kind === 'injury' ? 'Injured' : `${ep.severity === 'severe' ? 'Severe' : 'Mild'} illness`} since {ep.start}
            {status.stage === 'sick' ? ` · day ${status.day}` : ` · day ${status.day} of ${status.length}`}
            {ep.source === 'intervals' && ' · from intervals.icu'}
          </p>
          {status.stage === 'sick' && !ep.end && ep.source === 'local' && (
            <button type="button" onClick={() => void markBetter(ep.id, today)}>I'm better</button>
          )}
          {status.stage !== 'sick' && (
            <button type="button" className="danger" onClick={() => void markSick(ep.severity, ep.kind)}>Sick again</button>
          )}
        </>
      ) : open ? (
        <form
          className="form"
          onSubmit={(e) => {
            e.preventDefault();
            void markSick(severity, kind).then(() => setOpen(false));
          }}
        >
          <label className="check">
            <input type="radio" name="kind" checked={kind === 'illness'} onChange={() => setKind('illness')} /> Ill
          </label>
          {kind === 'illness' && (
            <>
              <label className="check indent">
                <input type="radio" name="sev" checked={severity === 'mild'} onChange={() => setSeverity('mild')} />
                Mild: above the neck, no fever (cold, sore throat)
              </label>
              <label className="check indent">
                <input type="radio" name="sev" checked={severity === 'severe'} onChange={() => setSeverity('severe')} />
                Severe: fever, aches, chest, stomach, flu/COVID
              </label>
            </>
          )}
          <label className="check">
            <input type="radio" name="kind" checked={kind === 'injury'} onChange={() => setKind('injury')} /> Injured
          </label>
          <div className="actions">
            <button type="submit" className="danger">Mark from today</button>
            <button type="button" onClick={() => setOpen(false)}>Cancel</button>
          </div>
          <p className="muted small">All sessions become rest until you mark yourself better, then a gradual return starts.</p>
        </form>
      ) : (
        <>
          <p className="muted">Healthy. Feeling ill or injured? The plan switches to rest and a gradual return.</p>
          <button type="button" onClick={() => setOpen(true)}>I'm sick / injured</button>
        </>
      )}
      {error && <p className="error small" role="alert">{error}</p>}
    </div>
  );
}

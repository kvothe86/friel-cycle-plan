import { ENERGY_SYSTEMS, type EnergySystem } from '../../engine/progression';
import { useLevels, useToday } from '../../store/hooks';

const NAMES: Record<EnergySystem, string> = {
  endurance: 'Endurance', tempo: 'Tempo', sweetspot: 'Sweet spot', threshold: 'Threshold', vo2: 'VO2max', anaerobic: 'Anaerobic / sprint',
};

export function LevelsCard() {
  const levels = useLevels(useToday());
  return (
    <div className="card">
      <h2>Progression levels</h2>
      <ul className="signals levels">
        {ENERGY_SYSTEMS.map((s) => (
          <li key={s}>
            <span>{NAMES[s]}</span>
            <meter min={1} max={10} value={levels[s]} />
            <span className="muted">{levels[s].toFixed(1)}</span>
          </li>
        ))}
      </ul>
      <p className="muted small">
        Up after planned sessions you complete, down after ones you can't finish; they slide after 3 weeks without that kind
        of work and drop after illness. Key sessions are built half a level above.
      </p>
    </div>
  );
}

import { zoneOf } from '../../engine/workout';
import { C } from '../theme';
import type { Segment } from '../../player/engine';
import type { Sample } from '../../player/recording';

interface Props {
  segments: readonly Segment[];
  elapsed: number;
  samples: readonly Sample[];
  ftp: number;
  intensity: number;
}

const W = 1000;
const H = 160;

/** Planned profile (zone colours), live power trace and a progress cursor. */
export function SessionProfile({ segments, elapsed, samples, ftp, intensity }: Props) {
  const total = segments.at(-1)?.end ?? 1;
  const maxFrac = Math.max(1.2, ...segments.map((s) => Math.max(s.from, s.to) * intensity));
  const maxW = Math.max(maxFrac * ftp, ...samples.map((s) => s.power ?? 0));
  const x = (t: number) => (t / total) * W;
  const y = (watts: number) => H - (watts / maxW) * (H - 4);
  // One polyline per continuous stretch: a skip or resume leaves a gap instead of a flat line.
  const traces: string[][] = [];
  let prev: number | undefined;
  for (const s of samples) {
    if (s.power === undefined) continue;
    if (prev === undefined || s.elapsed - prev > 2) traces.push([]);
    traces.at(-1)!.push(`${x(s.elapsed).toFixed(1)},${y(s.power).toFixed(1)}`);
    prev = s.elapsed;
  }

  return (
    <svg className="session-profile" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="Ride profile">
      {segments.map((s, i) => {
        const a = s.from * intensity * ftp;
        const b = s.to * intensity * ftp;
        const color = zoneOf((s.from + s.to) / 2).color;
        return (
          <polygon
            key={i}
            points={`${x(s.start)},${H} ${x(s.start)},${y(a)} ${x(s.end)},${y(b)} ${x(s.end)},${H}`}
            fill={color}
            opacity={s.end <= elapsed ? 0.35 : 0.8}
          />
        );
      })}
      <line x1={0} x2={W} y1={y(ftp)} y2={y(ftp)} className="ftp-line" />
      {traces.map((t, i) => (
        <polyline key={i} points={t.join(' ')} fill="none" stroke={C.text} strokeWidth={2} vectorEffect="non-scaling-stroke" />
      ))}
      <line x1={x(elapsed)} x2={x(elapsed)} y1={0} y2={H} stroke={C.accent} strokeWidth={3} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

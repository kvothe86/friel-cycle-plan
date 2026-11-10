import { flatten, zoneOf, type Block } from '../../engine/workout';

interface Props {
  blocks: readonly Block[];
  height?: number;
  /** Compact version for day cards: no axis line. */
  mini?: boolean;
}

/** Time-proportional intensity profile, coloured by power zone. */
export function WorkoutProfile({ blocks, height = 80, mini = false }: Props) {
  const steps = flatten(blocks);
  const total = steps.reduce((s, x) => s + x.seconds, 0) || 1;
  const top = Math.max(1.2, ...steps.map((s) => (s.kind === 'steady' ? s.power : Math.max(s.from, s.to))));
  const W = 300;
  const y = (p: number) => height - (p / top) * (height - 2);
  // Left edge of each step, as a running sum of the step widths.
  const starts = steps.reduce<number[]>((acc, s, i) => [...acc, (acc[i] ?? 0) + (s.seconds / total) * W], [0]);
  const shapes = steps.map((s, i) => {
    const w = (s.seconds / total) * W;
    const x0 = starts[i]!;
    if (s.kind === 'steady') {
      return <rect key={i} x={x0} y={y(s.power)} width={Math.max(0.5, w)} height={height - y(s.power)} fill={zoneOf(s.power).color} />;
    }
    const mid = (s.from + s.to) / 2;
    return (
      <polygon key={i} points={`${x0},${height} ${x0},${y(s.from)} ${x0 + w},${y(s.to)} ${x0 + w},${height}`} fill={zoneOf(mid).color} />
    );
  });
  return (
    <svg className={mini ? 'profile mini' : 'profile'} viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" role="img" aria-label="Workout profile">
      {!mini && <line x1={0} x2={W} y1={y(1)} y2={y(1)} className="ftp-line" />}
      {shapes}
    </svg>
  );
}

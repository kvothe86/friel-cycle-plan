interface Props {
  values: readonly (number | null)[];
  color?: string;
  height?: number;
  /** Fill the area under the line. */
  area?: boolean;
}

import { C } from '../theme';

/** Tiny trend line for stat tiles. */
export function Sparkline({ values, color = C.accent, height = 36, area = true }: Props) {
  const pts = values.map((v, i) => [i, v] as const).filter((p): p is readonly [number, number] => p[1] !== null);
  if (pts.length < 2) return null;
  const W = 120;
  const min = Math.min(...pts.map((p) => p[1]));
  const max = Math.max(...pts.map((p) => p[1]));
  const span = max - min || 1;
  const x = (i: number) => (i / (values.length - 1)) * W;
  const y = (v: number) => height - 3 - ((v - min) / span) * (height - 6);
  const line = pts.map(([i, v]) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const id = `spark-${color.replace(/[^a-z0-9]/gi, '')}`;
  return (
    <svg className="sparkline" viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity={0.35} />
          <stop offset="1" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      {area && <polygon points={`${x(pts[0]![0])},${height} ${line} ${x(pts.at(-1)![0])},${height}`} fill={`url(#${id})`} />}
      <polyline points={line} fill="none" stroke={color} strokeWidth={1.8} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}

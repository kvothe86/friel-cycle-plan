import { useState } from 'react';

export interface ChartSeries {
  label: string;
  color: string;
  values: (number | null)[];
  /** Draw as filled area against zero instead of a line. */
  area?: boolean;
  /** Use the right-hand axis. */
  right?: boolean;
  format?: (v: number) => string;
}

interface Props {
  dates: string[];
  series: ChartSeries[];
  height?: number;
  title: string;
}

const W = 900;
const PAD = { top: 12, right: 44, bottom: 24, left: 44 };

function extent(series: ChartSeries[], zero: boolean): [number, number] {
  const vals = series.flatMap((s) => s.values).filter((v): v is number => v !== null);
  if (vals.length === 0) return [0, 1];
  let lo = Math.min(...vals, ...(zero ? [0] : []));
  let hi = Math.max(...vals, ...(zero ? [0] : []));
  if (lo === hi) [lo, hi] = [lo - 1, hi + 1];
  const pad = (hi - lo) * 0.08;
  return [lo - pad, hi + pad];
}

/** Small dependency-free SVG time-series chart with a hover readout. */
export function LineChart({ dates, series, height = 220, title }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const n = dates.length;
  const left = series.filter((s) => !s.right);
  const right = series.filter((s) => s.right);
  const [lMin, lMax] = extent(left, left.some((s) => s.area));
  const [rMin, rMax] = extent(right, right.some((s) => s.area));

  const x = (i: number) => PAD.left + (n <= 1 ? 0 : (i / (n - 1)) * (W - PAD.left - PAD.right));
  const yScale = (min: number, max: number) => (v: number) =>
    PAD.top + (1 - (v - min) / (max - min)) * (height - PAD.top - PAD.bottom);
  const yL = yScale(lMin, lMax);
  const yR = yScale(rMin, rMax);

  const path = (s: ChartSeries) => {
    const y = s.right ? yR : yL;
    let d = '';
    let pen = false;
    s.values.forEach((v, i) => {
      if (v === null) {
        pen = false;
        return;
      }
      d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
      pen = true;
    });
    return d;
  };

  // Integer ticks that stay inside the plotted range (no labels drawn off the edge).
  const ticks = (min: number, max: number) => [
    ...new Set([Math.ceil(min), Math.round((min + max) / 2), Math.floor(max)]),
  ];
  const labelEvery = Math.max(1, Math.ceil(n / 8));

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const i = Math.round(((px - PAD.left) / (W - PAD.left - PAD.right)) * (n - 1));
    setHover(i >= 0 && i < n ? i : null);
  };

  return (
    <figure className="chart">
      <figcaption>
        <span className="chart-title">{title}</span>
        <span className="chart-legend">
          {series.map((s) => {
            const v = hover !== null ? s.values[hover] : s.values.findLast((x) => x !== null);
            const shown = v == null ? '–' : (s.format ?? ((x: number) => x.toFixed(0)))(v);
            return (
              <span key={s.label} style={{ color: s.color }}>
                {s.label} <strong>{shown}</strong>
              </span>
            );
          })}
          <span className="muted">{hover !== null ? dates[hover] : dates.at(-1)}</span>
        </span>
      </figcaption>
      <svg
        viewBox={`0 0 ${W} ${height}`}
        role="img"
        aria-label={title}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        {ticks(lMin, lMax).map((t) => (
          <g key={`l${t}`}>
            <line x1={PAD.left} x2={W - PAD.right} y1={yL(t)} y2={yL(t)} className="grid" />
            <text x={PAD.left - 6} y={yL(t) + 4} textAnchor="end" className="axis">{t}</text>
          </g>
        ))}
        {right.length > 0 &&
          ticks(rMin, rMax).map((t) => (
            <text key={`r${t}`} x={W - PAD.right + 6} y={yR(t) + 4} className="axis">{t}</text>
          ))}
        {left.some((s) => s.area) && lMin < 0 && lMax > 0 && (
          <line x1={PAD.left} x2={W - PAD.right} y1={yL(0)} y2={yL(0)} className="zero" />
        )}
        {dates.map((d, i) =>
          i % labelEvery === 0 ? (
            <text key={d} x={x(i)} y={height - 6} textAnchor="middle" className="axis">{d.slice(5)}</text>
          ) : null,
        )}
        {series.map((s) =>
          s.area ? (
            <g key={s.label} fill={s.color} opacity={0.35}>
              {s.values.map((v, i) => {
                if (v === null) return null;
                const y0 = (s.right ? yR : yL)(0);
                const y1 = (s.right ? yR : yL)(v);
                const w = Math.max(1, (W - PAD.left - PAD.right) / Math.max(1, n) - 1);
                return <rect key={i} x={x(i) - w / 2} y={Math.min(y0, y1)} width={w} height={Math.abs(y1 - y0)} />;
              })}
            </g>
          ) : (
            <path key={s.label} d={path(s)} fill="none" stroke={s.color} strokeWidth={2} />
          ),
        )}
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={height - PAD.bottom} className="cursor" />}
      </svg>
    </figure>
  );
}

interface Props {
  /** 0–100, or null for "no data". */
  value: number | null;
  color: string;
  size?: number;
  label?: string;
}

/** Radial gauge (270° arc) for scores like readiness. */
export function Ring({ value, color, size = 168, label }: Props) {
  const r = 70;
  const c = 2 * Math.PI * r;
  const arc = c * 0.75;
  const filled = value === null ? 0 : (Math.max(0, Math.min(100, value)) / 100) * arc;
  return (
    <svg className="ring" width={size} height={size} viewBox="0 0 180 180" role="img" aria-label={label ?? `Score ${value ?? 'unknown'}`}>
      <g transform="rotate(135 90 90)">
        <circle cx={90} cy={90} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={12} strokeLinecap="round" strokeDasharray={`${arc} ${c}`} />
        <circle
          cx={90}
          cy={90}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={12}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${c}`}
          className="ring-value"
          style={{ filter: `drop-shadow(0 0 10px ${color}55)` }}
        />
      </g>
      <text x={90} y={98} textAnchor="middle" className="ring-number">{value ?? '–'}</text>
    </svg>
  );
}

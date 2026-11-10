export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0) return '–';
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return h > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${m} min`;
}

export function formatNumber(v: number | null | undefined, digits = 0): string {
  return typeof v === 'number' && Number.isFinite(v) ? v.toFixed(digits) : '–';
}

export function formatSigned(v: number | null | undefined): string {
  if (typeof v !== 'number' || !Number.isFinite(v)) return '–';
  const r = Math.round(v);
  return r > 0 ? `+${r}` : String(r);
}

export function formatRelativeTime(iso: string | undefined, now = Date.now()): string {
  if (!iso) return 'never';
  const mins = Math.round((now - Date.parse(iso)) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}

const CYCLING_TYPES = new Set(['Ride', 'VirtualRide', 'GravelRide', 'MountainBikeRide', 'EBikeRide', 'TrackRide']);
export const isCycling = (type: string | null | undefined) => !!type && CYCLING_TYPES.has(type);

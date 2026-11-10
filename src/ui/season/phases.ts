import { addDays, daysBetween, type IsoDate } from '../../lib/dates';
import type { ChartBand, ChartMarker } from '../components/LineChart';
import type { Phase, SeasonPlan } from '../../engine/macro';

export const PHASE_LABELS: Record<Phase, string> = { base: 'Base', build: 'Build', peak: 'Peak', race: 'Race' };
export const PHASE_COLORS: Record<Phase | 'recovery', string> = {
  base: 'rgba(108, 184, 255, 0.08)',
  build: 'rgba(255, 138, 61, 0.10)',
  peak: 'rgba(228, 255, 58, 0.10)',
  race: 'rgba(61, 220, 151, 0.16)',
  recovery: 'rgba(255, 255, 255, 0.025)',
};
const PRIORITY_COLORS = { A: '#3DDC97', B: '#FFB547', C: '#7D828C' } as const;

/** Daily target CTL from today, linearly interpolated within each plan week. */
export function dailyTargetCtl(plan: SeasonPlan, today: IsoDate): Map<IsoDate, number> {
  const out = new Map<IsoDate, number>();
  let prev = plan.startCtl;
  let anchor = today;
  for (const w of plan.weeks) {
    const end = addDays(w.start, 7);
    const from = anchor > w.start ? anchor : w.start;
    const span = daysBetween(from, end);
    for (let i = 0; i <= span; i++) out.set(addDays(from, i), prev + ((w.targetCtl - prev) * i) / Math.max(1, span));
    prev = w.targetCtl;
    anchor = end;
  }
  return out;
}

/** Merges consecutive weeks of the same phase into chart bands. */
export function phaseBands(plan: SeasonPlan, dates: IsoDate[]): ChartBand[] {
  const index = new Map(dates.map((d, i) => [d, i]));
  const bands: ChartBand[] = [];
  for (const w of plan.weeks) {
    const from = index.get(w.start) ?? (dates[0] !== undefined && w.start < dates[0] ? 0 : undefined);
    const to = index.get(addDays(w.start, 6)) ?? dates.length - 1;
    if (from === undefined) continue;
    const key = w.recovery ? 'recovery' : w.phase;
    const last = bands.at(-1);
    if (last && last.color === PHASE_COLORS[key] && last.to + 1 >= from) {
      last.to = to;
    } else {
      bands.push({ from, to, color: PHASE_COLORS[key], label: w.recovery ? undefined : PHASE_LABELS[w.phase] });
    }
  }
  return bands;
}

export function eventMarkers(plan: SeasonPlan, dates: IsoDate[]): ChartMarker[] {
  const index = new Map(dates.map((d, i) => [d, i]));
  return plan.weeks.flatMap((w) =>
    w.events
      .filter((e) => index.has(e.date))
      .map((e) => ({ index: index.get(e.date)!, label: `${e.priority}: ${e.name}`, color: PRIORITY_COLORS[e.priority] })),
  );
}

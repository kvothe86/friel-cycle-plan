import type { IsoDate } from '../lib/dates';
import type { ReadinessLabel } from './readiness';
import { healthStatus, type SicknessEpisode } from './sickness';
import type { DayStatus } from './week';

/**
 * Daily adjuster (PLAN §3.6): turns health, readiness and the user's own
 * choices into per-day statuses the week planner respects.
 * Precedence: sick/symptom-free rest → skip → return-to-training stage →
 * easier/endurance → readiness (today only).
 */

export type DayAction = 'skip' | 'easier' | 'endurance';

export interface DayActionRecord {
  date: IsoDate;
  action: DayAction;
}

export interface TodayReadiness {
  score: number | null;
  label: ReadinessLabel | null;
}

export function dayStatuses(input: {
  today: IsoDate;
  dates: readonly IsoDate[];
  episodes: readonly SicknessEpisode[];
  actions: readonly DayActionRecord[];
  readiness?: TodayReadiness;
}): Map<IsoDate, DayStatus> {
  const { today, dates, episodes, actions, readiness } = input;
  const actionByDate = new Map(actions.map((a) => [a.date, a.action]));
  const out = new Map<IsoDate, DayStatus>();

  for (const date of dates) {
    const health = healthStatus(date, episodes, today);
    const action = actionByDate.get(date);
    const healthRest = health?.stage === 'sick' || health?.stage === 'symptom-free';
    if (action === 'skip' && !healthRest) {
      out.set(date, { kind: 'rest', reason: 'Skipped by you. Missed load is not made up later.' });
      continue;
    }
    if (health) {
      const injury = health.episode.kind === 'injury';
      const what = injury ? 'injury' : 'illness';
      switch (health.stage) {
        case 'sick':
          out.set(date, {
            kind: 'rest',
            reason: injury
              ? `Injured (day ${health.day}): rest.`
              : `Sick (day ${health.day}): rest.${health.episode.severity === 'mild' ? ' An easy spin of up to 45 min in Z1 is fine if you feel like it.' : ''}`,
          });
          break;
        case 'symptom-free':
          out.set(date, { kind: 'rest', reason: `Symptom-free day ${health.day} of ${health.length} after a severe illness: still rest.` });
          break;
        case 'reentry':
          out.set(date, { kind: 'limit', limit: 'reentry', reason: `Back after ${what}, re-entry day ${health.day} of ${health.length}: short endurance only.` });
          break;
        case 'reload':
          out.set(date, { kind: 'limit', limit: 'reload', reason: `Back after ${what}, reload day ${health.day} of ${health.length}: endurance, tempo or sweet spot; no threshold or VO2 yet.` });
          break;
      }
      continue;
    }

    if (action === 'easier') {
      out.set(date, { kind: 'limit', limit: 'easier', reason: 'Made easier by you: lower level, shorter.' });
      continue;
    }
    if (action === 'endurance') {
      out.set(date, { kind: 'limit', limit: 'no-hard', reason: 'Swapped to endurance by you. The key session moves to another day if one fits.' });
      continue;
    }

    if (date === today && readiness?.label && readiness.score !== null) {
      if (readiness.label === 'low') {
        out.set(date, { kind: 'limit', limit: 'recovery', reason: `Readiness low (${readiness.score}): recovery only today. The key session moves to another day if one fits.` });
      } else if (readiness.label === 'reduced') {
        out.set(date, { kind: 'limit', limit: 'no-hard', reason: `Readiness reduced (${readiness.score}): no hard session today.` });
      }
    }
  }
  return out;
}

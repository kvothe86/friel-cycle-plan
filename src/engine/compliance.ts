import type { IcuActivity, IcuEvent } from '../integrations/intervals/types';
import { isOurs } from './push';

/** How a completed ride compares with the planned session (feeds M5 progression). */
export type ComplianceStatus = 'completed' | 'partial' | 'missed';

export interface Compliance {
  status: ComplianceStatus;
  loadRatio: number;
  timeRatio: number;
  /** Rode clearly harder than planned. */
  over: boolean;
}

export const COMPLETED_RATIO = 0.8;
export const PARTIAL_RATIO = 0.3;
export const OVER_RATIO = 1.3;

export function compliance(planned: { load: number; seconds: number }, actual: { load: number; seconds: number }): Compliance {
  const loadRatio = planned.load > 0 ? actual.load / planned.load : 1;
  const timeRatio = planned.seconds > 0 ? actual.seconds / planned.seconds : 1;
  const status: ComplianceStatus =
    loadRatio >= COMPLETED_RATIO && timeRatio >= COMPLETED_RATIO ? 'completed' : loadRatio >= PARTIAL_RATIO ? 'partial' : 'missed';
  return { status, loadRatio, timeRatio, over: loadRatio > OVER_RATIO };
}

/**
 * Finds the planned app workout an activity belongs to: intervals.icu's own
 * pairing first (paired_event_id), else an app workout on the same day.
 */
export function plannedFor(activity: Pick<IcuActivity, 'paired_event_id' | 'start_date_local'>, events: readonly IcuEvent[]): IcuEvent | undefined {
  const ours = events.filter((e) => e.category === 'WORKOUT' && isOurs(e));
  return (
    ours.find((e) => activity.paired_event_id != null && e.id === activity.paired_event_id) ??
    ours.find((e) => e.start_date_local.slice(0, 10) === activity.start_date_local.slice(0, 10))
  );
}

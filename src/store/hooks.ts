import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { addDays, startOfWeek, toIsoDate, type IsoDate } from '../lib/dates';
import { buildPmcSeries, dailyLoads, type PmcPoint } from '../engine/pmc';
import { computeReadiness, HRV_BASELINE_DAYS, type Readiness } from '../engine/readiness';
import type { IcuSportSettings } from '../integrations/intervals/types';
import { db, type StoredActivity, type StoredEvent } from './db';
import type { BlockedRange } from '../engine/availability';
import { planSeason, type SeasonPlan } from '../engine/macro';
import { resolveRange } from '../engine/availability';
import { isCycling } from '../engine/sports';
import { isHardActivity, planHorizon, type DayPlan, type DoneActivity } from '../engine/week';
import { fixedWorkouts, type PushedRecord } from '../engine/push';
import {
  DEFAULT_AVAILABILITY, DEFAULT_PLAN_SETTINGS,
  type AvailabilityOverride, type AvailabilityTemplate, type Goal, type PlanSettings,
} from '../engine/types';

export const useCredentials = () => useLiveQuery(() => db.getMeta('credentials'), [], undefined);
export const useAthlete = () => useLiveQuery(() => db.getMeta('athlete'), [], undefined);
export const useLastSync = () => useLiveQuery(() => db.getMeta('lastSync'), [], undefined);

export function useToday(): IsoDate {
  return toIsoDate(new Date());
}

export function useWellness(from: IsoDate, to: IsoDate) {
  return useLiveQuery(() => db.wellness.where('id').between(from, to, true, true).toArray(), [from, to], []);
}

export function useActivities(from: IsoDate, to: IsoDate) {
  return useLiveQuery(
    () => db.activities.where('date').between(from, to, true, true).reverse().sortBy('start_date_local'),
    [from, to],
    [],
  );
}

/** Daily CTL/ATL/TSB for the `days` days up to and including `to`. */
export function usePmc(to: IsoDate, days: number): PmcPoint[] {
  const from = addDays(to, -(days - 1));
  const wellness = useWellness(addDays(from, -1), to);
  const activities = useActivities(from, to);
  return useMemo(
    () => buildPmcSeries(wellness, dailyLoads(activities), from, to),
    [wellness, activities, from, to],
  );
}

export function useReadiness(date: IsoDate): Readiness {
  const wellness = useWellness(addDays(date, -HRV_BASELINE_DAYS - 7), date);
  const pmc = usePmc(date, 1);
  const tsb = pmc.at(-1)?.tsb;
  return useMemo(() => computeReadiness(wellness, date, tsb), [wellness, date, tsb]);
}

export function rideSettings(settings: IcuSportSettings[] | undefined): IcuSportSettings | undefined {
  return settings?.find((s) => s.types?.includes('Ride')) ?? settings?.[0];
}

// ---- M2: goals, availability, season plan ----

export const useGoals = () => useLiveQuery(() => db.goals.toArray(), [], [] as Goal[]);
export const useOverrides = () => useLiveQuery(() => db.overrides.orderBy('date').toArray(), [], [] as AvailabilityOverride[]);

/** undefined while loading; `isDefault` when the user never saved a template. */
export function useAvailability(): { template: AvailabilityTemplate; isDefault: boolean } | undefined {
  return useLiveQuery(async () => {
    const t = await db.getMeta('availability');
    return { template: t ?? DEFAULT_AVAILABILITY, isDefault: !t };
  }, []);
}

export function usePlanSettings(): PlanSettings {
  return useLiveQuery(() => db.getMeta('planSettings'), [], undefined) ?? DEFAULT_PLAN_SETTINGS;
}

/**
 * HOLIDAY events from intervals.icu block training. All-day multi-day
 * events end at 00:00 on the day after, so that end is treated as exclusive.
 */
export function holidayRanges(events: readonly StoredEvent[]): BlockedRange[] {
  return events
    .filter((e) => e.category === 'HOLIDAY')
    .map((e) => {
      let end = e.date;
      if (e.end_date_local) {
        const endDate = e.end_date_local.slice(0, 10);
        const midnight = e.end_date_local.slice(11, 19) === '00:00:00';
        end = midnight && endDate > e.date ? addDays(endDate, -1) : endDate;
      }
      return { start: e.date, end, reason: e.name?.trim() || 'Holiday (intervals.icu)' };
    });
}

export function useBlockedRanges(): BlockedRange[] {
  const events = useLiveQuery(() => db.events.where('category').equals('HOLIDAY').toArray(), [], [] as StoredEvent[]);
  return useMemo(() => holidayRanges(events), [events]);
}

export function useSeasonPlan(today: IsoDate): SeasonPlan | undefined {
  const goals = useGoals();
  const availability = useAvailability();
  const overrides = useOverrides();
  const blocked = useBlockedRanges();
  const settings = usePlanSettings();
  const currentCtl = usePmc(today, 1).at(-1)?.ctl ?? 0;
  return useMemo(
    () =>
      availability &&
      planSeason({ today, goals, currentCtl, template: availability.template, overrides, blocked, settings }),
    [today, goals, currentCtl, availability, overrides, blocked, settings],
  );
}

// ---- M3: 14-day plan ----

export const PLAN_HORIZON_DAYS = 14;

export function toDoneActivities(activities: readonly StoredActivity[]): DoneActivity[] {
  return activities.map((a) => ({
    date: a.date,
    name: a.name ?? a.type ?? 'Activity',
    load: a.icu_training_load ?? 0,
    hard: isHardActivity({ cycling: isCycling(a.type), load: a.icu_training_load, intensity: a.icu_intensity, rpe: a.icu_rpe }),
    cycling: isCycling(a.type),
  }));
}

/** The 14-day plan, re-derived whenever data, goals or availability change. */
export function usePlanHorizon(today: IsoDate): DayPlan[] | undefined {
  const plan = useSeasonPlan(today);
  const availability = useAvailability();
  const overrides = useOverrides();
  const blocked = useBlockedRanges();
  const settings = usePlanSettings();
  const activities = useActivities(addDays(startOfWeek(today), -1), today);
  const fixed = useFixedWorkouts(today);
  return useMemo(() => {
    if (!plan || !availability) return undefined;
    const days = resolveRange(today, PLAN_HORIZON_DAYS, availability.template, overrides, blocked);
    return planHorizon({ today, plan, days, done: toDoneActivities(activities), experience: settings.experience, fixed });
  }, [plan, availability, overrides, blocked, settings.experience, activities, today, fixed]);
}

// ---- M4: intervals.icu push ----

export const usePushed = () => useLiveQuery(() => db.pushed.toArray(), [], [] as PushedRecord[]);
export const usePushSettings = () => useLiveQuery(() => db.getMeta('pushSettings'), [], undefined) ?? { auto: false };
export const useLastPush = () => useLiveQuery(() => db.getMeta('lastPush'), [], undefined);

/** WORKOUT events in the horizon (the user's own, and app ones they edited). */
export function useFixedWorkouts(today: IsoDate) {
  const end = addDays(today, PLAN_HORIZON_DAYS - 1);
  const events = useLiveQuery(
    () => db.events.where('date').between(today, end, true, true).filter((e) => e.category === 'WORKOUT').toArray(),
    [today, end],
    [] as StoredEvent[],
  );
  const pushed = usePushed();
  return useMemo(() => fixedWorkouts(events, pushed), [events, pushed]);
}

export function useTodayPlannedEvent(today: IsoDate) {
  return useLiveQuery(
    () => db.events.where('date').equals(today).filter((e) => e.category === 'WORKOUT' && !!e.external_id?.startsWith('cyclinghub-')).first(),
    [today],
  );
}

export function useFtp(): number | undefined {
  const athlete = useAthlete();
  return rideSettings(athlete?.sportSettings)?.ftp ?? undefined;
}

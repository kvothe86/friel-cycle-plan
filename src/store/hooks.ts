import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { addDays, toIsoDate, type IsoDate } from '../lib/dates';
import { buildPmcSeries, dailyLoads, type PmcPoint } from '../engine/pmc';
import { computeReadiness, HRV_BASELINE_DAYS, type Readiness } from '../engine/readiness';
import type { IcuSportSettings } from '../integrations/intervals/types';
import { db } from './db';

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

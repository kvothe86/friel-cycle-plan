import type { IcuActivity, IcuAthlete, IcuEvent, IcuEventInput, IcuWellness } from './types';
import type { IsoDate } from '../../lib/dates';

export const INTERVALS_BASE_URL = 'https://intervals.icu/api/v1';

export interface IntervalsCredentials {
  athleteId: string;
  apiKey: string;
}

export class IntervalsError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'IntervalsError';
    this.status = status;
  }
  get isAuthError(): boolean {
    return this.status === 401 || this.status === 403;
  }
}

type FetchFn = typeof fetch;

/** Normalises user input: "i12345", "12345" and " i12345 " → "i12345". */
export function normaliseAthleteId(raw: string): string {
  const trimmed = raw.trim();
  if (/^\d+$/.test(trimmed)) return `i${trimmed}`;
  return trimmed;
}

export class IntervalsClient {
  private readonly creds: IntervalsCredentials;
  private readonly fetchFn: FetchFn;

  constructor(creds: IntervalsCredentials, fetchFn: FetchFn = (...a) => fetch(...a)) {
    this.creds = { athleteId: normaliseAthleteId(creds.athleteId), apiKey: creds.apiKey.trim() };
    this.fetchFn = fetchFn;
  }

  getAthlete(): Promise<IcuAthlete> {
    return this.get<IcuAthlete>('');
  }

  getWellness(oldest: IsoDate, newest: IsoDate): Promise<IcuWellness[]> {
    return this.get<IcuWellness[]>('/wellness', { oldest, newest });
  }

  getActivities(oldest: IsoDate, newest: IsoDate): Promise<IcuActivity[]> {
    return this.get<IcuActivity[]>('/activities', { oldest, newest });
  }

  getEvents(oldest: IsoDate, newest: IsoDate): Promise<IcuEvent[]> {
    return this.get<IcuEvent[]>('/events', { oldest, newest });
  }

  /**
   * Creates or updates planned events. With `upsert`, events whose
   * `external_id` already exists are updated instead of duplicated.
   */
  createEventsBulk(events: IcuEventInput[]): Promise<IcuEvent[]> {
    return this.request<IcuEvent[]>('POST', '/events/bulk', { upsert: 'true' }, events);
  }

  deleteEvent(eventId: number): Promise<unknown> {
    return this.request('DELETE', `/events/${eventId}`);
  }

  private get<T>(path: string, query?: Record<string, string>): Promise<T> {
    return this.request<T>('GET', path, query);
  }

  private async request<T>(method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, query?: Record<string, string>, body?: unknown): Promise<T> {
    const url = new URL(`${INTERVALS_BASE_URL}/athlete/${encodeURIComponent(this.creds.athleteId)}${path}`);
    for (const [k, v] of Object.entries(query ?? {})) url.searchParams.set(k, v);

    const headers: Record<string, string> = {
      Authorization: `Basic ${btoa(`API_KEY:${this.creds.apiKey}`)}`,
      Accept: 'application/json',
    };
    if (body !== undefined) headers['Content-Type'] = 'application/json';

    let res: Response;
    try {
      res = await this.fetchFn(url.toString(), {
        method,
        headers,
        ...(body !== undefined && { body: JSON.stringify(body) }),
      });
    } catch (err) {
      throw new IntervalsError(0, `Network error reaching intervals.icu: ${(err as Error).message}`);
    }

    if (!res.ok) {
      const hint =
        res.status === 401 || res.status === 403
          ? 'Check your athlete ID and API key.'
          : res.status === 404
            ? method === 'GET' ? 'Athlete not found. Check your athlete ID.' : 'Not found in intervals.icu (already deleted?).'
            : res.status === 429
              ? 'Rate limited by intervals.icu. Try again in a minute.'
              : '';
      throw new IntervalsError(res.status, `intervals.icu returned ${res.status}. ${hint}`.trim());
    }
    const text = await res.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }
}

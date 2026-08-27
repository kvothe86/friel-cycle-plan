import { corsPreflight, forwardIntervals, getApiKey, getAthleteId, jsonResponse } from './_shared/intervals.mjs';

export default async (req) => {
  if (req.method === 'OPTIONS') return corsPreflight();
  if (req.method !== 'GET') return jsonResponse({ error: 'Method not allowed' }, 405);

  const apiKey = getApiKey(req);
  if (!apiKey) return jsonResponse({ error: 'Missing API key' }, 401);

  const url = new URL(req.url);
  const athleteId = getAthleteId(url);
  if (!athleteId) return jsonResponse({ error: 'athleteId query param is required' }, 400);

  const oldest = url.searchParams.get('oldest');
  const newest = url.searchParams.get('newest');
  if (!oldest || !newest) return jsonResponse({ error: 'oldest and newest query params are required' }, 400);

  const upstream = new URL(`https://intervals.icu/api/v1/athlete/${encodeURIComponent(athleteId)}/wellness`);
  upstream.searchParams.set('oldest', oldest);
  upstream.searchParams.set('newest', newest);

  return forwardIntervals(upstream, apiKey);
};

export const config = {
  path: '/api/intervals/wellness',
};

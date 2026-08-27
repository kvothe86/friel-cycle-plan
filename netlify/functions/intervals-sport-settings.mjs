import { corsPreflight, forwardIntervals, getApiKey, getAthleteId, jsonResponse } from './_shared/intervals.mjs';

export default async (req) => {
  if (req.method === 'OPTIONS') return corsPreflight();
  if (req.method !== 'GET' && req.method !== 'PUT') return jsonResponse({ error: 'Method not allowed' }, 405);

  const apiKey = getApiKey(req);
  if (!apiKey) return jsonResponse({ error: 'Missing API key' }, 401);

  const url = new URL(req.url);
  const athleteId = getAthleteId(url);
  if (!athleteId) return jsonResponse({ error: 'athleteId query param is required' }, 400);

  const sport = url.searchParams.get('sport') || 'Ride';
  const upstream = `https://intervals.icu/api/v1/athlete/${encodeURIComponent(athleteId)}/sport-settings/${encodeURIComponent(sport)}`;

  if (req.method === 'PUT') {
    const body = await req.text();
    return forwardIntervals(upstream, apiKey, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
  }

  return forwardIntervals(upstream, apiKey);
};

export const config = {
  path: '/api/intervals/sport-settings',
};

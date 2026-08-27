export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, X-Intervals-Api-Key',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
};

export function jsonResponse(body, status = 200) {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

export function corsPreflight() {
  return new Response(null, { status: 204, headers: CORS });
}

export function getApiKey(req) {
  return req.headers.get('x-intervals-api-key')?.trim() || '';
}

export function getAthleteId(url) {
  return url.searchParams.get('athleteId')?.trim() || '';
}

export function authHeaders(apiKey) {
  const token = Buffer.from(`API_KEY:${apiKey}`).toString('base64');
  return {
    Authorization: `Basic ${token}`,
    Accept: 'application/json',
  };
}

export async function forwardIntervals(url, apiKey, init = {}) {
  try {
    const res = await fetch(url, {
      ...init,
      headers: {
        ...authHeaders(apiKey),
        ...(init.headers || {}),
      },
    });
    const body = await res.text();
    return new Response(body, {
      status: res.status,
      headers: {
        ...CORS,
        'Content-Type': res.headers.get('content-type') || 'application/json',
      },
    });
  } catch {
    return jsonResponse({ error: 'Could not reach intervals.icu' }, 502);
  }
}

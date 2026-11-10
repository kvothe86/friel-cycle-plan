import { IntervalsClient, IntervalsError, normaliseAthleteId } from './client';

function mockFetch(body: unknown, status = 200) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status }));
}

describe('IntervalsClient', () => {
  it('normalises athlete ids', () => {
    expect(normaliseAthleteId(' 12345 ')).toBe('i12345');
    expect(normaliseAthleteId('i12345')).toBe('i12345');
  });

  it('sends Basic auth with API_KEY user and builds the URL', async () => {
    const f = mockFetch([]);
    const client = new IntervalsClient({ athleteId: '42', apiKey: ' secret ' }, f);
    await client.getWellness('2026-11-01', '2026-11-10');

    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://intervals.icu/api/v1/athlete/i42/wellness?oldest=2026-11-01&newest=2026-11-10');
    expect((init.headers as Record<string, string>).Authorization).toBe(`Basic ${btoa('API_KEY:secret')}`);
  });

  it('maps 401 to an auth error with a hint', async () => {
    const client = new IntervalsClient({ athleteId: 'i1', apiKey: 'x' }, mockFetch({}, 401));
    const err = await client.getAthlete().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(IntervalsError);
    expect((err as IntervalsError).isAuthError).toBe(true);
    expect((err as IntervalsError).message).toMatch(/API key/);
  });

  it('wraps network failures', async () => {
    const f = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    const client = new IntervalsClient({ athleteId: 'i1', apiKey: 'x' }, f);
    await expect(client.getAthlete()).rejects.toMatchObject({ status: 0 });
  });
});

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

describe('IntervalsClient writes', () => {
  it('bulk-upserts events with a JSON body', async () => {
    const f = vi.fn(async () => new Response(JSON.stringify([{ id: 5, category: 'WORKOUT', start_date_local: '2026-11-12T00:00:00' }]), { status: 200 }));
    const client = new IntervalsClient({ athleteId: 'i1', apiKey: 'k' }, f);
    const input = { category: 'WORKOUT' as const, start_date_local: '2026-11-12T00:00:00', type: 'Ride', name: 'x', description: '- 10m 65%', external_id: 'cyclinghub-2026-11-12', moving_time: 600, icu_training_load: 7 };
    const out = await client.createEventsBulk([input]);
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://intervals.icu/api/v1/athlete/i1/events/bulk?upsert=true');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual([input]);
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
    expect(out[0]!.id).toBe(5);
  });

  it('deletes an event and tolerates an empty response body', async () => {
    const f = vi.fn(async () => new Response(null, { status: 200 }));
    const client = new IntervalsClient({ athleteId: 'i1', apiKey: 'k' }, f);
    await client.deleteEvent(42);
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://intervals.icu/api/v1/athlete/i1/events/42');
    expect(init.method).toBe('DELETE');
  });
});

describe('uploadActivity', () => {
  it('posts the FIT as multipart with name and pairing', async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ id: 'i99' }), { status: 200 }));
    const client = new IntervalsClient({ athleteId: 'i1', apiKey: 'k' }, f);
    const res = await client.uploadActivity(new Uint8Array([1, 2, 3]), 'ride.fit', { name: 'Sweet spot', pairedEventId: 42 });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://intervals.icu/api/v1/athlete/i1/activities?name=Sweet+spot&paired_event_id=42');
    expect(init.method).toBe('POST');
    expect(init.body).toBeInstanceOf(FormData);
    expect((init.headers as Record<string, string>)['Content-Type']).toBeUndefined();
    expect(((init.body as FormData).get('file') as File).name).toBe('ride.fit');
    expect(res.id).toBe('i99');
  });
});

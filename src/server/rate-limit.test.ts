import { clientIp, createRateLimiter, hashClient } from './rate-limit';

type Call = {
  url: string;
  body: { p_bucket: string; p_window_seconds: number; p_limit: number };
  headers: Record<string, string>;
};

function fakeDb(answers: (boolean | number | Error)[]) {
  const calls: Call[] = [];
  let next = 0;
  const fetch = (async (url: string, init: RequestInit) => {
    calls.push({
      url,
      body: JSON.parse(init.body as string),
      headers: init.headers as Record<string, string>,
    });
    const answer = answers[next++];
    if (answer instanceof Error) throw answer;
    if (typeof answer === 'number') return new Response('{}', { status: answer });
    return new Response(JSON.stringify(answer), { status: 200 });
  }) as unknown as typeof globalThis.fetch;
  return { fetch, calls };
}

const request = (ip = '203.0.113.7, 10.0.0.1') =>
  new Request('http://localhost', { method: 'POST', headers: { 'x-forwarded-for': ip } });

const config = {
  supabaseUrl: 'https://abc.supabase.co',
  dbKey: 'service-key',
  hashSecret: 'secret',
  perClientPerHour: 10,
  globalPerHour: 200,
  now: () => new Date('2026-10-15T12:00:00Z'),
};

describe('createRateLimiter', () => {
  it('checks the client bucket, then the global bucket, with the service key', async () => {
    const db = fakeDb([true, true]);
    await expect(createRateLimiter({ ...config, fetch: db.fetch }).allow(request())).resolves.toBe(
      true,
    );

    expect(db.calls).toHaveLength(2);
    expect(db.calls[0]!.url).toBe('https://abc.supabase.co/rest/v1/rpc/consume_rate_limit');
    expect(db.calls[0]!.headers).toMatchObject({ apikey: 'service-key' });
    expect(db.calls[0]!.body).toEqual({
      p_bucket: `client:${await hashClient('203.0.113.7', '2026-10-15', 'secret')}`,
      p_window_seconds: 3600,
      p_limit: 10,
    });
    expect(db.calls[1]!.body).toEqual({ p_bucket: 'global', p_window_seconds: 3600, p_limit: 200 });
  });

  it('never sends the IP address to the database', async () => {
    const db = fakeDb([true, true]);
    await createRateLimiter({ ...config, fetch: db.fetch }).allow(request());
    expect(JSON.stringify(db.calls)).not.toContain('203.0.113.7');
  });

  it('denies when the client is over its limit without spending global budget', async () => {
    const db = fakeDb([false]);
    await expect(createRateLimiter({ ...config, fetch: db.fetch }).allow(request())).resolves.toBe(
      false,
    );
    expect(db.calls).toHaveLength(1);
  });

  it('denies when the global limit is reached', async () => {
    const db = fakeDb([true, false]);
    await expect(createRateLimiter({ ...config, fetch: db.fetch }).allow(request())).resolves.toBe(
      false,
    );
  });

  it('fails closed on database errors', async () => {
    for (const answer of [500, new TypeError('offline')]) {
      const db = fakeDb([answer]);
      await expect(
        createRateLimiter({ ...config, fetch: db.fetch }).allow(request()),
      ).resolves.toBe(false);
    }
  });
});

describe('hashClient', () => {
  it('is stable per day and secret, and changes with either', async () => {
    const a = await hashClient('203.0.113.7', '2026-10-15', 'secret');
    expect(a).toMatch(/^[0-9a-f]{32}$/);
    expect(await hashClient('203.0.113.7', '2026-10-15', 'secret')).toBe(a);
    expect(await hashClient('203.0.113.7', '2026-10-16', 'secret')).not.toBe(a);
    expect(await hashClient('203.0.113.7', '2026-10-15', 'other')).not.toBe(a);
    expect(await hashClient('203.0.113.8', '2026-10-15', 'secret')).not.toBe(a);
  });
});

describe('clientIp', () => {
  it('uses the first X-Forwarded-For address, then X-Real-IP', () => {
    expect(clientIp(request(' 198.51.100.2 , 10.0.0.1'))).toBe('198.51.100.2');
    expect(
      clientIp(new Request('http://localhost', { headers: { 'x-real-ip': '198.51.100.3' } })),
    ).toBe('198.51.100.3');
    expect(clientIp(new Request('http://localhost'))).toBe('unknown');
  });
});

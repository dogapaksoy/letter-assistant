import { requestExtraction, type Fetch } from './api';

const config = { url: 'https://abc.supabase.co', publishableKey: 'sb_publishable_test' };
const request = { language: 'en' as const, document: { kind: 'text' as const, text: 'Brief' } };

const success = {
  ok: true,
  letterText: 'Brief',
  textMethod: 'text',
  extraction: { summary: [], deadlines: [], actions: [] },
  dropped: { summary: 0, deadlines: 0, actions: 0 },
  model: 'm',
  promptVersion: 'extraction-v1',
  devMode: false,
};

function fakeFetch(response: Response | Error): { fetch: Fetch; calls: [string, RequestInit][] } {
  const calls: [string, RequestInit][] = [];
  const fetch = (async (url: string, init: RequestInit) => {
    calls.push([url, init]);
    if (response instanceof Error) throw response;
    return response;
  }) as unknown as Fetch;
  return { fetch, calls };
}

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('requestExtraction', () => {
  it('posts to the edge function with the publishable key and returns the result', async () => {
    const { fetch, calls } = fakeFetch(jsonResponse(success));
    const result = await requestExtraction(request, { ...config, fetch });

    expect(result).toEqual({ ok: true, data: success });
    const [url, init] = calls[0]!;
    expect(url).toBe('https://abc.supabase.co/functions/v1/extract-letter');
    expect(init.headers).toMatchObject({ apikey: 'sb_publishable_test' });
    expect(JSON.parse(init.body as string)).toEqual(request);
  });

  it('returns server error codes', async () => {
    const { fetch } = fakeFetch(jsonResponse({ ok: false, error: 'ocr_not_configured' }, 501));
    await expect(requestExtraction(request, { ...config, fetch })).resolves.toEqual({
      ok: false,
      error: 'ocr_not_configured',
    });
  });

  it('turns network failures, bad JSON and unexpected shapes into error codes', async () => {
    await expect(
      requestExtraction(request, { ...config, ...fakeFetch(new TypeError('offline')) }),
    ).resolves.toEqual({ ok: false, error: 'network' });
    await expect(
      requestExtraction(request, {
        ...config,
        ...fakeFetch(new Response('<html>', { status: 502 })),
      }),
    ).resolves.toEqual({ ok: false, error: 'service_unavailable' });
    await expect(
      requestExtraction(request, {
        ...config,
        ...fakeFetch(jsonResponse({ ok: true, letterText: 1 })),
      }),
    ).resolves.toEqual({ ok: false, error: 'invalid_response' });
  });

  it('reports not_configured without calling the network when env is missing', async () => {
    const { fetch, calls } = fakeFetch(jsonResponse(success));
    await expect(
      requestExtraction(request, { url: '', publishableKey: '', fetch }),
    ).resolves.toEqual({ ok: false, error: 'not_configured' });
    expect(calls).toHaveLength(0);
  });
});

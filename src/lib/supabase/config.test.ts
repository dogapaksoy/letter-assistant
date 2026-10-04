import { parseSupabaseConfig } from './config';

const url = 'https://abcdefgh.supabase.co';
const publishableKey = 'sb_publishable_example123';

function jwtWithRole(role: string): string {
  const encode = (value: object) =>
    btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ role })}.signature`;
}

describe('parseSupabaseConfig', () => {
  it('accepts a URL and a publishable key, trimming whitespace', () => {
    expect(parseSupabaseConfig({ url: ` ${url} `, publishableKey: `${publishableKey}\n` })).toEqual(
      {
        url,
        publishableKey,
      },
    );
  });

  it('accepts a legacy anon key', () => {
    const anonKey = jwtWithRole('anon');
    expect(parseSupabaseConfig({ url, publishableKey: anonKey })).toEqual({
      url,
      publishableKey: anonKey,
    });
  });

  it('explains how to configure missing values', () => {
    expect(() => parseSupabaseConfig({ url: undefined, publishableKey })).toThrow(/\.env\.example/);
    expect(() => parseSupabaseConfig({ url, publishableKey: '  ' })).toThrow(/not configured/);
  });

  it('rejects URLs that are not plain https origins', () => {
    expect(() =>
      parseSupabaseConfig({ url: 'http://abcdefgh.supabase.co', publishableKey }),
    ).toThrow(/must look like/);
    expect(() => parseSupabaseConfig({ url: `${url}/rest/v1`, publishableKey })).toThrow(
      /must look like/,
    );
  });

  it('refuses secret keys', () => {
    expect(() => parseSupabaseConfig({ url, publishableKey: 'sb_secret_abc' })).toThrow(
      /secret key/,
    );
    expect(() => parseSupabaseConfig({ url, publishableKey: jwtWithRole('service_role') })).toThrow(
      /secret key/,
    );
  });

  it('never puts the key itself into the error message', () => {
    try {
      parseSupabaseConfig({ url, publishableKey: 'sb_secret_DO_NOT_LEAK' });
    } catch (error) {
      expect(String(error)).not.toContain('DO_NOT_LEAK');
    }
    expect.assertions(1);
  });
});

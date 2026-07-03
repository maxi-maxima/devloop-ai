import { describe, expect, test } from 'vitest';
import { InstallationTokenCache } from './installation-token.js';

describe('GitHub App installation token cache', () => {
  test('requests and caches installation tokens until near expiration', async () => {
    let calls = 0;
    const cache = new InstallationTokenCache({
      createJwt: () => 'jwt-token',
      now: () => new Date('2026-07-03T00:00:00Z'),
      fetchImpl: async (url, init) => {
        calls += 1;
        expect(url).toBe('https://api.github.com/app/installations/42/access_tokens');
        expect(init?.method).toBe('POST');
        expect(init?.headers).toMatchObject({ Authorization: 'Bearer jwt-token' });

        return jsonResponse({
          token: `installation-token-${calls}`,
          expires_at: '2026-07-03T01:00:00Z'
        });
      }
    });

    await expect(cache.getToken(42)).resolves.toMatchObject({ token: 'installation-token-1' });
    await expect(cache.getToken(42)).resolves.toMatchObject({ token: 'installation-token-1' });
    expect(calls).toBe(1);
  });
});

function jsonResponse(body: unknown) {
  return {
    ok: true,
    status: 201,
    statusText: 'Created',
    json: async () => body
  };
}

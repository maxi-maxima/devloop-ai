import { describe, expect, test, vi } from 'vitest';
import { buildAuthenticatedRemoteUrl, createPullRequest } from './pull-request.js';

describe('GitHub pull request integration', () => {
  test('creates PRs through the GitHub REST API', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ html_url: 'https://github.com/acme/widgets/pull/1', number: 1 })
    }));

    const result = await createPullRequest(
      {
        token: 'ghp_test',
        owner: 'acme',
        repo: 'widgets',
        title: 'DevLoop AI fix',
        head: 'devloop/ai-fix-1',
        base: 'main',
        body: 'Automated fix.'
      },
      fetchMock
    );

    expect(result.url).toBe('https://github.com/acme/widgets/pull/1');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.github.com/repos/acme/widgets/pulls',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer ghp_test',
          Accept: 'application/vnd.github+json'
        }),
        body: JSON.stringify({
          title: 'DevLoop AI fix',
          head: 'devloop/ai-fix-1',
          base: 'main',
          body: 'Automated fix.'
        })
      })
    );
  });

  test('builds token-authenticated HTTPS remotes without changing the logged URL shape', () => {
    expect(
      buildAuthenticatedRemoteUrl('https://github.com/acme/widgets.git', 'ghp_test')
    ).toBe('https://x-access-token:ghp_test@github.com/acme/widgets.git');
  });
});

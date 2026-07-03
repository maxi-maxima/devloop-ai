import { describe, expect, test } from 'vitest';
import { fetchWorkflowRunLogs } from './workflow-logs.js';

describe('GitHub workflow log fetching', () => {
  test('follows the GitHub workflow run log redirect and returns log text', async () => {
    const calls: string[] = [];
    const logs = await fetchWorkflowRunLogs({
      owner: 'octo',
      repo: 'hello',
      runId: 123,
      token: 'installation-token',
      fetchImpl: async (url, init) => {
        calls.push(url);
        if (url.includes('/actions/runs/123/logs')) {
          expect(init?.headers).toMatchObject({ Authorization: 'Bearer installation-token' });
          return {
            ok: false,
            status: 302,
            statusText: 'Found',
            headers: { get: (name: string) => (name.toLowerCase() === 'location' ? 'https://logs.example/zip' : null) },
            text: async () => ''
          };
        }

        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          headers: { get: () => 'text/plain' },
          text: async () => 'npm test failed\nTypeError'
        };
      }
    });

    expect(calls).toEqual([
      'https://api.github.com/repos/octo/hello/actions/runs/123/logs',
      'https://logs.example/zip'
    ]);
    expect(logs).toContain('TypeError');
  });
});

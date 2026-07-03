import { describe, expect, test } from 'vitest';
import { computeGitHubSignature } from './signature.js';
import { createMemoryJobStore } from './job-store.js';
import { handleGitHubWebhookRequest } from './routes.js';

describe('GitHub App webhook routes', () => {
  test('rejects invalid signatures and accepts signed failed workflow events', async () => {
    const store = createMemoryJobStore();
    const body = Buffer.from(JSON.stringify(workflowRunPayload()));

    await expect(
      handleGitHubWebhookRequest({
        body,
        headers: {
          'x-github-event': 'workflow_run',
          'x-github-delivery': 'delivery-1',
          'x-hub-signature-256': 'sha256=bad'
        },
        webhookSecret: 'secret',
        store
      })
    ).resolves.toMatchObject({ status: 401 });

    await expect(
      handleGitHubWebhookRequest({
        body,
        headers: {
          'x-github-event': 'workflow_run',
          'x-github-delivery': 'delivery-1',
          'x-hub-signature-256': computeGitHubSignature('secret', body)
        },
        webhookSecret: 'secret',
        store
      })
    ).resolves.toMatchObject({ status: 202, result: { action: 'queued' } });

    await expect(
      handleGitHubWebhookRequest({
        body,
        headers: {
          'x-github-event': 'workflow_run',
          'x-github-delivery': 'delivery-1',
          'x-hub-signature-256': computeGitHubSignature('secret', body)
        },
        webhookSecret: 'secret',
        store
      })
    ).resolves.toMatchObject({ status: 202, result: { action: 'duplicate-delivery' } });
  });
});

function workflowRunPayload() {
  return {
    action: 'completed',
    installation: { id: 42 },
    repository: { full_name: 'octo/hello', default_branch: 'main' },
    workflow_run: {
      id: 100,
      conclusion: 'failure',
      head_sha: 'abc123',
      head_branch: 'main',
      html_url: 'https://github.com/octo/hello/actions/runs/100',
      name: 'CI'
    }
  };
}

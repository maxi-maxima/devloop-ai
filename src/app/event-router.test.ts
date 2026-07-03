import { describe, expect, test } from 'vitest';
import { createMemoryJobStore } from './job-store.js';
import { routeGitHubEvent } from './event-router.js';

describe('GitHub App event router', () => {
  test('queues a failed workflow_run.completed job and deduplicates it', async () => {
    const store = createMemoryJobStore();
    const payload = workflowRunPayload();

    const first = await routeGitHubEvent({
      eventName: 'workflow_run',
      deliveryId: 'delivery-1',
      payload,
      store
    });
    const duplicate = await routeGitHubEvent({
      eventName: 'workflow_run',
      deliveryId: 'delivery-2',
      payload,
      store
    });

    expect(first).toMatchObject({ action: 'queued', job: { repository: 'octo/hello' } });
    expect(first.job?.idempotencyKey).toBe('octo/hello:workflow_run:100:abc123');
    expect(duplicate).toMatchObject({ action: 'duplicate' });
  });

  test('skips successful workflow runs and unsupported events', async () => {
    const store = createMemoryJobStore();
    expect(
      await routeGitHubEvent({
        eventName: 'workflow_run',
        deliveryId: 'delivery-1',
        payload: { ...workflowRunPayload(), workflow_run: { ...workflowRunPayload().workflow_run, conclusion: 'success' } },
        store
      })
    ).toMatchObject({ action: 'skipped' });

    await expect(
      routeGitHubEvent({ eventName: 'push', deliveryId: 'delivery-2', payload: {}, store })
    ).rejects.toThrow(/Unsupported GitHub event/);
  });

  test('routes slash commands and refuses untrusted users', async () => {
    const store = createMemoryJobStore();
    const trusted = await routeGitHubEvent({
      eventName: 'issue_comment',
      deliveryId: 'delivery-1',
      payload: issueCommentPayload('/devloop diagnose', 'COLLABORATOR'),
      store
    });
    const refused = await routeGitHubEvent({
      eventName: 'issue_comment',
      deliveryId: 'delivery-2',
      payload: issueCommentPayload('/devloop fix', 'NONE'),
      store
    });
    const securityFix = await routeGitHubEvent({
      eventName: 'issue_comment',
      deliveryId: 'delivery-3',
      payload: issueCommentPayload('/devloop security-fix codeql', 'COLLABORATOR'),
      store
    });

    expect(trusted).toMatchObject({ action: 'queued', command: 'diagnose' });
    expect(refused).toMatchObject({ action: 'refused' });
    expect(securityFix).toMatchObject({ action: 'queued', command: 'security-fix' });
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

function issueCommentPayload(body: string, association: string) {
  return {
    action: 'created',
    installation: { id: 42 },
    repository: { full_name: 'octo/hello', default_branch: 'main' },
    issue: { number: 7, pull_request: { url: 'https://api.github.com/repos/octo/hello/pulls/7' } },
    comment: {
      id: 88,
      body,
      author_association: association,
      user: { login: 'stranger' }
    }
  };
}

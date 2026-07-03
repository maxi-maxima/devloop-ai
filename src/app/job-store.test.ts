import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import { SqliteJobStore } from './job-store.js';

const tempDirs: string[] = [];

describe('SQLite job store', () => {
  afterEach(async () => {
    await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
    tempDirs.length = 0;
  });

  test('persists deliveries and deduplicates idempotent jobs', async () => {
    const dbPath = await tempDbPath();
    const store = new SqliteJobStore(dbPath);
    await store.initialize();

    await expect(store.recordDelivery('delivery-1', 'workflow_run')).resolves.toBe(true);
    await expect(store.recordDelivery('delivery-1', 'workflow_run')).resolves.toBe(false);

    const first = await store.createJobIfAbsent({
      idempotencyKey: 'octo/hello:workflow_run:123:abc',
      repository: 'octo/hello',
      installationId: 42,
      eventType: 'workflow_run.completed',
      triggerSha: 'abc',
      status: 'queued'
    });
    const second = await store.createJobIfAbsent({
      idempotencyKey: 'octo/hello:workflow_run:123:abc',
      repository: 'octo/hello',
      installationId: 42,
      eventType: 'workflow_run.completed',
      triggerSha: 'abc',
      status: 'queued'
    });

    expect(second.created).toBe(false);
    expect(second.job.id).toBe(first.job.id);

    await store.updateJob(first.job.id, { status: 'succeeded', prUrl: 'https://github.com/octo/hello/pull/1' });
    await store.appendJobLog(first.job.id, 'pr created');
    await expect(store.getJob(first.job.id)).resolves.toMatchObject({
      status: 'succeeded',
      prUrl: 'https://github.com/octo/hello/pull/1'
    });
    await expect(store.listJobLogs(first.job.id)).resolves.toEqual(['pr created']);
    await store.close();
  });
});

async function tempDbPath(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'devloop-app-store-'));
  tempDirs.push(dir);
  return path.join(dir, 'devloop.sqlite');
}

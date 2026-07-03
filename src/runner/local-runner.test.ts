import { cp, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import { LocalRunner } from './local-runner.js';

const tempDirs: string[] = [];

describe('Local sandbox runner', () => {
  afterEach(async () => {
    await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
    tempDirs.length = 0;
  });

  test('runs a fixture test command with timeout and output limits', async () => {
    const repoPath = await copyFixture();
    const runner = new LocalRunner({ allowLocalRunner: true, timeoutMs: 10_000, outputLimit: 20_000 });

    const result = await runner.run({
      repoPath,
      command: 'npm test'
    });

    expect(result.exitCode).toBe(1);
    expect(result.passed).toBe(false);
    expect(result.stdout + result.stderr).toContain('TypeError');
    expect(result.sandbox.kind).toBe('local');
  });
});

async function copyFixture(): Promise<string> {
  const target = await mkdtemp(path.join(tmpdir(), 'devloop-local-runner-'));
  tempDirs.push(target);
  await cp(path.resolve('fixtures/failing-node-repo'), target, { recursive: true });
  return target;
}

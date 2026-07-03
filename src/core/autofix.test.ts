import { cp, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import { runAutoFix } from './autofix.js';
import { AiProvider } from '../ai/providers/index.js';

const tempDirs: string[] = [];

describe('runAutoFix', () => {
  afterEach(async () => {
    await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
  });

  test('dry-run returns a unified diff preview without modifying files', async () => {
    const repoPath = await copyFixture();
    const provider = new StaticPatchProvider(fixturePatch());

    const result = await runAutoFix({
      repoPath,
      log: sampleFailureLog(),
      testCommand: 'npm test',
      maxRetries: 1,
      dryRun: true,
      noPr: true,
      provider
    });

    expect(result.status).toBe('dry-run');
    expect(result.evidence?.runId).toMatch(/^run-/);
    await expect(readFile(path.join(repoPath, '.devloop', 'evidence', result.evidence!.runId, 'evidence.json'), 'utf8')).resolves.toContain('"schemaVersion"');
    expect(result.patch).toContain('--- a/src/user.js');
    expect(result.safety.passed).toBe(true);
    await expect(readFile(path.join(repoPath, 'src', 'user.js'), 'utf8')).resolves.toContain(
      'user.name.trim()'
    );
  });

  test('fixes the failing fixture repo and reruns tests successfully', async () => {
    const repoPath = await copyFixture();
    const provider = new StaticPatchProvider(fixturePatch());

    const result = await runAutoFix({
      repoPath,
      log: sampleFailureLog(),
      testCommand: 'npm test',
      maxRetries: 1,
      dryRun: false,
      noPr: true,
      provider
    });

    expect(result.status).toBe('fixed');
    expect(result.prBody).toContain('## Evidence Bundle');
    expect(result.testResult?.passed).toBe(true);
    expect(result.changedFiles).toEqual(['src/user.js']);
  });

  test('retries with the latest failure log until tests pass', async () => {
    const repoPath = await copyFixture();
    const provider = new SequencePatchProvider([
      `--- a/src/user.js\n+++ b/src/user.js\n@@ -1,5 +1,5 @@\n function formatUser(user) {\n-  const name = user.name.trim();\n+  const name = ''.trim();\n   return name || 'Anonymous';\n }\n \n module.exports = { formatUser };\n`,
      fixturePatch()
    ]);

    const result = await runAutoFix({
      repoPath,
      log: sampleFailureLog(),
      testCommand: 'npm test',
      maxRetries: 2,
      dryRun: false,
      noPr: true,
      provider
    });

    expect(result.status).toBe('fixed');
    expect(result.attempts).toBe(2);
    expect(provider.calls).toBe(2);
  });
});

class StaticPatchProvider implements AiProvider {
  readonly name = 'test';
  readonly model = 'static';

  constructor(private readonly patch: string) {}

  async complete(): Promise<string> {
    return this.patch;
  }
}

class SequencePatchProvider implements AiProvider {
  readonly name = 'test';
  readonly model = 'sequence';
  calls = 0;

  constructor(private readonly patches: string[]) {}

  async complete(): Promise<string> {
    return this.patches[this.calls++] ?? this.patches.at(-1)!;
  }
}

async function copyFixture(): Promise<string> {
  const target = await mkdtemp(path.join(tmpdir(), 'devloop-fixture-'));
  tempDirs.push(target);
  await cp(path.resolve('fixtures/failing-node-repo'), target, { recursive: true });
  return target;
}

function fixturePatch(): string {
  return `--- a/src/user.js\n+++ b/src/user.js\n@@ -1,5 +1,5 @@\n function formatUser(user) {\n-  const name = user.name.trim();\n+  const name = (user.name ?? 'Anonymous').trim();\n   return name || 'Anonymous';\n }\n \n module.exports = { formatUser };\n`;
}

function sampleFailureLog(): string {
  return [
    '> failing-node-repo@1.0.0 test',
    '> node test/user.test.js',
    "TypeError: Cannot read properties of undefined (reading 'trim')",
    'at formatUser (src/user.js:2:26)',
    'at Object.<anonymous> (test/user.test.js:5:14)'
  ].join('\n');
}

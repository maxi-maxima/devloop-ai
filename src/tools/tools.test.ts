import { cp, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import { autofixTool } from './autofixTool.js';
import { diagnoseTool } from './diagnoseTool.js';
import { devloopTools } from './index.js';
import { patchReviewTool } from './patchReviewTool.js';
import { assertMatchesSchema, ToolValidationError } from './types.js';

const tempDirs: string[] = [];

describe('DevLoop tools', () => {
  afterEach(async () => {
    await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
    tempDirs.length = 0;
  });

  test('exports a stable tool registry', () => {
    expect(devloopTools.map((tool) => tool.name)).toEqual(expect.arrayContaining([
      'devloop.diagnose',
      'devloop.autofix',
      'devloop.reviewPatch',
      'devloop.firewall.checkInput',
      'devloop.firewall.checkCommand',
      'devloop.firewall.checkPatch',
      'devloop.firewall.scanRepo',
      'devloop.firewall.redact'
    ]));

    for (const tool of devloopTools) {
      expect(tool.description.length).toBeGreaterThan(20);
      expect(tool.inputSchema.type).toBe('object');
      expect(tool.outputSchema.type).toBe('object');
      expect(tool.execute).toEqual(expect.any(Function));
    }
  });

  test('validates diagnose input schema with logText or logFile', () => {
    expect(() =>
      assertMatchesSchema(diagnoseTool.inputSchema, {
        repoPath: path.resolve('.'),
        logText: sampleFailureLog()
      })
    ).not.toThrow();

    expect(() => assertMatchesSchema(diagnoseTool.inputSchema, { repoPath: path.resolve('.') })).toThrow(
      ToolValidationError
    );
    expect(() =>
      assertMatchesSchema(diagnoseTool.inputSchema, {
        repoPath: 123,
        logText: sampleFailureLog()
      })
    ).toThrow(ToolValidationError);
  });

  test('executes diagnose and validates the output schema', async () => {
    const diagnosis = await diagnoseTool.execute({
      repoPath: path.resolve('.'),
      logText: sampleFailureLog()
    });

    expect(diagnosis.summary).toContain('TypeError');
    expect(diagnosis.likely_files).toContain('src/user.js');
    expect(() => assertMatchesSchema(diagnoseTool.outputSchema, diagnosis)).not.toThrow();
  });

  test('executes patch review through the safety guardrails', async () => {
    const result = await patchReviewTool.execute({
      repoPath: path.resolve('.'),
      patch: `--- a/.env\n+++ b/.env\n@@ -1 +1 @@\n-OPENAI_API_KEY=old\n+OPENAI_API_KEY=new\n`
    });

    expect(result.passed).toBe(false);
    expect(result.forbiddenFiles).toEqual(['.env']);
    expect(() => assertMatchesSchema(patchReviewTool.outputSchema, result)).not.toThrow();
  });

  test('executes autofix dry-run with the deterministic demo provider', async () => {
    const repoPath = await copyFixture();
    const logFile = path.join(repoPath, 'failure.log');
    await writeFile(logFile, sampleFailureLog(), 'utf8');

    const result = await autofixTool.execute({
      repoPath,
      logFile,
      testCommand: 'npm test',
      dryRun: true,
      maxRetries: 1,
      provider: 'demo'
    });

    expect(result.status).toBe('dry-run');
    expect(result.changedFiles).toEqual(['src/user.js']);
    expect(result.safety.passed).toBe(true);
    expect(result.evidence?.runId).toMatch(/^run-/);
    expect(() => assertMatchesSchema(autofixTool.outputSchema, result)).not.toThrow();
  });
});

async function copyFixture(): Promise<string> {
  const target = await mkdtemp(path.join(tmpdir(), 'devloop-tool-fixture-'));
  tempDirs.push(target);
  await cp(path.resolve('fixtures/failing-node-repo'), target, { recursive: true });
  return target;
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

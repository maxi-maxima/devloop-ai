import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import {
  appendEvidenceSummary,
  createEvidenceBundle,
  exportEvidenceBundle,
  verifyEvidenceBundle
} from './index.js';

const tempDirs: string[] = [];

describe('evidence bundles', () => {
  afterEach(async () => {
    await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
    tempDirs.length = 0;
  });

  test('writes a redacted schema-valid bundle with patch and log hashes', async () => {
    const repoPath = await tempDir();
    const result = await createEvidenceBundle({
      repoPath,
      trigger: { type: 'autofix', repository: 'octo/demo', commitSha: 'abc123' },
      model: { provider: 'demo', model: 'fixture' },
      sandbox: { runner: 'local', network: 'disabled', secretsMounted: false, timeoutSeconds: 30, user: 'devloop' },
      diagnosis: { summary: 'Fix failing test', confidence: 0.9, likelyFiles: ['src/user.js'] },
      patch: '--- a/src/user.js\n+++ b/src/user.js\n@@ -1 +1 @@\n-old\n+new\n',
      testBeforeLog: 'failed with OPENAI_API_KEY=sk-proj-abcdefghijklmnopqrstuvwxyz1234567890',
      testAfterLog: 'passed',
      validationCommands: [
        { command: 'npm test', exitCode: 1, durationMs: 100, passed: false, logName: 'test-before.log' },
        { command: 'npm test', exitCode: 0, durationMs: 120, passed: true, logName: 'test-after.log' }
      ],
      firewall: { decision: 'allow', riskLevel: 'low', findingsCount: 0 },
      prBody: '## Summary\nFix failing test'
    });

    const evidenceJson = JSON.parse(await readFile(path.join(result.path, 'evidence.json'), 'utf8')) as {
      runId: string;
      patch: { sha256: string; linesAdded: number; linesDeleted: number };
      validation: { commands: { logSha256: string }[] };
    };
    expect(evidenceJson.runId).toBe(result.bundle.runId);
    expect(evidenceJson.patch.linesAdded).toBe(1);
    expect(evidenceJson.patch.linesDeleted).toBe(1);

    const beforeLog = await readFile(path.join(result.path, 'test-before.log'), 'utf8');
    expect(beforeLog).toContain('[REDACTED_OPENAI_KEY]');
    expect(beforeLog).not.toContain('sk-proj-abcdefghijklmnopqrstuvwxyz1234567890');

    const verification = await verifyEvidenceBundle(result.path);
    expect(verification.valid).toBe(true);
    expect(verification.errors).toEqual([]);
  });

  test('detects tampered patch hashes', async () => {
    const repoPath = await tempDir();
    const result = await createEvidenceBundle(minimalBundleInput(repoPath));
    await writeFile(path.join(result.path, 'patch.diff'), 'tampered\n', 'utf8');

    const verification = await verifyEvidenceBundle(result.path);
    expect(verification.valid).toBe(false);
    expect(verification.errors.join('\n')).toContain('patch.diff sha256 mismatch');
  });

  test('exports markdown and zip bundles', async () => {
    const repoPath = await tempDir();
    const result = await createEvidenceBundle(minimalBundleInput(repoPath));

    const markdown = await exportEvidenceBundle({
      runId: result.bundle.runId,
      evidenceRoot: path.join(repoPath, '.devloop', 'evidence'),
      format: 'markdown',
      outputDir: repoPath
    });
    expect(markdown.outputPath.endsWith('.md')).toBe(true);
    await expect(readFile(markdown.outputPath, 'utf8')).resolves.toContain('# DevLoop Evidence Bundle');

    const zip = await exportEvidenceBundle({
      runId: result.bundle.runId,
      evidenceRoot: path.join(repoPath, '.devloop', 'evidence'),
      format: 'zip',
      outputDir: repoPath
    });
    const zipBytes = await readFile(zip.outputPath);
    expect(zip.outputPath.endsWith('.zip')).toBe(true);
    expect(zipBytes.subarray(0, 4).toString('hex')).toBe('504b0304');
  });

  test('appends an evidence section to PR bodies', async () => {
    const body = appendEvidenceSummary('## Summary\nFix', {
      runId: 'run-123',
      path: '.devloop/evidence/run-123',
      riskLevel: 'medium',
      sandboxMode: 'local',
      testCommand: 'npm test',
      humanReviewRequired: true
    });

    expect(body).toContain('## Evidence Bundle');
    expect(body).toContain('run-123');
    expect(body).toContain('Human review required: yes');
  });
});

async function tempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'devloop-evidence-'));
  tempDirs.push(dir);
  await mkdir(path.join(dir, '.devloop'), { recursive: true });
  return dir;
}

function minimalBundleInput(repoPath: string): Parameters<typeof createEvidenceBundle>[0] {
  return {
    repoPath,
    trigger: { type: 'test' },
    model: { provider: 'demo', model: 'fixture' },
    sandbox: { runner: 'local', network: 'disabled', secretsMounted: false, timeoutSeconds: 30, user: 'devloop' },
    diagnosis: { summary: 'Test diagnosis', confidence: 0.8, likelyFiles: ['index.js'] },
    patch: '--- a/index.js\n+++ b/index.js\n@@ -1 +1 @@\n-old\n+new\n',
    testBeforeLog: 'before',
    testAfterLog: 'after',
    validationCommands: [
      { command: 'npm test', exitCode: 1, durationMs: 1, passed: false, logName: 'test-before.log' },
      { command: 'npm test', exitCode: 0, durationMs: 2, passed: true, logName: 'test-after.log' }
    ],
    firewall: { decision: 'allow', riskLevel: 'low', findingsCount: 0 },
    prBody: 'PR body'
  };
}

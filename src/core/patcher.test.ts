import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import { applyUnifiedDiff, parseUnifiedDiff, previewPatch } from './patcher.js';

const tempDirs: string[] = [];

describe('patcher', () => {
  afterEach(async () => {
    await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
  });

  test('parses touched files from unified diff output', () => {
    const files = parseUnifiedDiff(`--- a/src/foo.ts\n+++ b/src/foo.ts\n@@ -1 +1 @@\n-old\n+new\n`);

    expect(files).toEqual([{ oldPath: 'src/foo.ts', newPath: 'src/foo.ts' }]);
  });

  test('rejects malformed patch output', () => {
    expect(() => parseUnifiedDiff('not a diff')).toThrow(/unified diff/i);
  });

  test('parses padded file headers without regex backtracking', () => {
    const padding = ' '.repeat(8000);
    const files = parseUnifiedDiff(`--- ${padding}a/src/foo.ts\n+++ ${padding}b/src/foo.ts\n@@ -1 +1 @@\n-old\n+new\n`);

    expect(files).toEqual([{ oldPath: 'src/foo.ts', newPath: 'src/foo.ts' }]);
  });

  test('shows a dry-run preview without modifying files', async () => {
    const repoPath = await makeRepo();
    const patch = `--- a/index.js\n+++ b/index.js\n@@ -1 +1 @@\n-module.exports = () => 1;\n+module.exports = () => 2;\n`;

    const result = await previewPatch(repoPath, patch);

    expect(result.dryRun).toBe(true);
    expect(result.changedFiles).toEqual(['index.js']);
    await expect(readFile(path.join(repoPath, 'index.js'), 'utf8')).resolves.toBe(
      'module.exports = () => 1;\n'
    );
  });

  test('applies a safe unified diff patch', async () => {
    const repoPath = await makeRepo();
    const patch = `--- a/index.js\n+++ b/index.js\n@@ -1 +1 @@\n-module.exports = () => 1;\n+module.exports = () => 2;\n`;

    const result = await applyUnifiedDiff(repoPath, patch);

    expect(result.changedFiles).toEqual(['index.js']);
    await expect(readFile(path.join(repoPath, 'index.js'), 'utf8')).resolves.toBe(
      'module.exports = () => 2;\n'
    );
  });
});

async function makeRepo(): Promise<string> {
  const repoPath = await mkdtemp(path.join(tmpdir(), 'devloop-patcher-'));
  tempDirs.push(repoPath);
  await writeFile(path.join(repoPath, 'index.js'), 'module.exports = () => 1;\n', 'utf8');
  return repoPath;
}

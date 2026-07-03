import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import { applyFileChanges } from './fixer.js';

let tempDirs: string[] = [];

describe('applyFileChanges', () => {
  afterEach(async () => {
    await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
    tempDirs = [];
  });

  test('writes model-proposed file replacements inside the repository', async () => {
    const repoPath = await mkdtemp(path.join(tmpdir(), 'devloop-fix-'));
    tempDirs.push(repoPath);

    const changed = await applyFileChanges(repoPath, [
      { file: 'src/index.ts', content: "console.log('fixed');\n" }
    ]);

    await expect(readFile(path.join(repoPath, 'src/index.ts'), 'utf8')).resolves.toBe(
      "console.log('fixed');\n"
    );
    expect(changed).toEqual(['src/index.ts']);
  });

  test('refuses path traversal outside the repository', async () => {
    const repoPath = await mkdtemp(path.join(tmpdir(), 'devloop-fix-'));
    tempDirs.push(repoPath);

    await expect(
      applyFileChanges(repoPath, [{ file: '../escape.ts', content: 'bad' }])
    ).rejects.toThrow(/outside repository/i);
  });
});

import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, test } from 'vitest';

describe('demo artifacts', () => {
  test('fixture is a tiny Node project with src, test, and npm test', async () => {
    const root = path.resolve('fixtures/failing-node-repo');
    const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8')) as {
      scripts?: Record<string, string>;
    };

    await expect(access(path.join(root, 'src', 'user.js'))).resolves.toBeUndefined();
    await expect(access(path.join(root, 'test', 'user.test.js'))).resolves.toBeUndefined();
    expect(packageJson.scripts?.test).toBe('node test/user.test.js');
  });

  test('demo script uses polished demo mode', async () => {
    const script = await readFile(path.resolve('scripts/demo-autofix.sh'), 'utf8');

    expect(script).toContain('devloop autofix');
    expect(script).toContain('--demo');
    expect(script).toContain('--dry-run');
    expect(script).toContain('git diff');
  });

  test('Codex skill package has required files and trigger metadata', async () => {
    const root = path.resolve('.agents/skills/devloop-autofix');
    const skill = await readFile(path.join(root, 'SKILL.md'), 'utf8');
    const runner = await readFile(path.join(root, 'scripts', 'run-devloop-autofix.sh'), 'utf8');

    await expect(access(path.join(root, 'references', 'safety.md'))).resolves.toBeUndefined();
    await expect(access(path.join(root, 'references', 'examples.md'))).resolves.toBeUndefined();
    expect(skill).toContain('name: devloop-autofix');
    expect(skill).toContain('description: Use this skill when');
    expect(skill).toContain('devloop autofix --dry-run');
    expect(runner).toContain('LOG_FILE');
    expect(runner).toContain('TEST_COMMAND');
  });
});

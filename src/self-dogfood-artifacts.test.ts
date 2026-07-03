import { access, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { describe, expect, test } from 'vitest';

const require = createRequire(import.meta.url);

describe('self-dogfood artifacts', () => {
  test('fixture is a passing minimal Node project before failure is introduced', async () => {
    const root = path.resolve('fixtures/self-dogfood');
    const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8')) as {
      scripts?: Record<string, string>;
    };
    const fixture = require(path.join(root, 'src', 'user.js')) as {
      formatUser: (user: { name?: string }) => string;
    };

    await expect(access(path.join(root, 'src', 'user.js'))).resolves.toBeUndefined();
    await expect(access(path.join(root, 'test', 'user.test.js'))).resolves.toBeUndefined();
    expect(packageJson.scripts?.test).toBe('node test/user.test.js');
    expect(fixture.formatUser({})).toBe('Anonymous');
    expect(fixture.formatUser({ name: ' Ada ' })).toBe('Ada');
  });

  test('self-dogfood scripts encode the safe branch and local demo workflow', async () => {
    const start = await readFile(path.resolve('scripts/self-dogfood/start.sh'), 'utf8');
    const reset = await readFile(path.resolve('scripts/self-dogfood/reset.sh'), 'utf8');
    const local = await readFile(path.resolve('scripts/self-dogfood/local.sh'), 'utf8');

    expect(start).toContain('dogfood/failing-ci');
    expect(start).toContain('git status --porcelain');
    expect(start).toContain('git switch -c');
    expect(start).toContain('git push');
    expect(start).toContain('fixtures/self-dogfood');

    expect(reset).toContain('dogfood/failing-ci');
    expect(reset).toContain('git switch main');
    expect(reset).toContain('git branch -D');

    expect(local).toContain('devloop autofix --dry-run');
    expect(local).toContain('--demo');
    expect(local).toContain('--no-pr');
    expect(local).toContain('git diff');
    expect(local).toContain('DEVLOOP_SELF_DOGFOOD_KEEP');
  });

  test('self-dogfood docs, README, and CI workflow describe both real PR paths', async () => {
    const readme = await readFile(path.resolve('README.md'), 'utf8');
    const docs = await readFile(path.resolve('docs/self-dogfooding.md'), 'utf8');
    const workflow = await readFile(path.resolve('.github/workflows/self-dogfood.yml'), 'utf8');

    expect(readme).toContain('## DevLoop fixed itself');
    expect(readme).toContain('Real self-fix PR:');
    expect(readme).toContain('https://github.com/maxi-maxima/devloop-ai/pull/7');
    expect(readme).not.toContain('https://github.com/<owner>/devloop-ai/pull/<number>');
    expect(docs).toContain('https://github.com/maxi-maxima/devloop-ai/pull/7');
    expect(docs).not.toContain('https://github.com/<owner>/devloop-ai/pull/<number>');
    expect(docs).toContain('Path A: DevLoop GitHub App');
    expect(docs).toContain('Path B: DevLoop GitHub Action');
    expect(docs).toContain('evidence bundle');
    expect(docs).toContain('firewall report');
    expect(workflow).toContain('fixtures/self-dogfood');
    expect(workflow).toContain('npm --prefix fixtures/self-dogfood test');
  });
});

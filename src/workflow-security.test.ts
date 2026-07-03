import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, test } from 'vitest';

const workflows = [
  '.github/workflows/ci.yml',
  '.github/workflows/fixbench.yml',
  '.github/workflows/release.yml',
  '.github/workflows/security.yml',
  '.github/workflows/self-dogfood.yml',
  '.github/workflows/self-dogfood-devloop.yml',
  'templates/github-actions/devloop-autofix.yml'
];

async function readWorkflow(relativePath: string): Promise<string> {
  return readFile(path.resolve(relativePath), 'utf8');
}

describe('GitHub workflow security posture', () => {
  test('security workflow grants read access to Dependabot pull request metadata', async () => {
    const workflow = await readWorkflow('.github/workflows/security.yml');

    expect(workflow).toMatch(/permissions:\s*\n(?:  .+\n)*  contents: read\n(?:  .+\n)*  pull-requests: read/);
    expect(workflow).toContain('gitleaks/gitleaks-action@v3.0.0');
  });

  test.each(workflows)('%s uses current official action pins', async (relativePath) => {
    const workflow = await readWorkflow(relativePath);

    expect(workflow).not.toMatch(/actions\/checkout@v4\b/);
    expect(workflow).not.toMatch(/actions\/setup-node@v4\b/);
    expect(workflow).not.toMatch(/actions\/upload-artifact@v4\b/);
    expect(workflow).not.toMatch(/github\/codeql-action\/(?:init|autobuild|analyze)@v3\b/);
    expect(workflow).not.toMatch(/gitleaks\/gitleaks-action@v2\b/);
  });
});

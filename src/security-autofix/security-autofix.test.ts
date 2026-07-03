import { cp, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import { selectSarifAlerts } from './alert-selector.js';
import { buildSecurityPrBody } from './security-pr-body.js';
import { reviewSecurityPatchPolicy } from './security-policy.js';
import { runSecurityAutofix } from './security-patch-generator.js';
import { parseSarifFile } from './sarif-parser.js';

const tempDirs: string[] = [];

describe('security autofix SARIF support', () => {
  afterEach(async () => {
    await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
    tempDirs.length = 0;
  });

  test('parses SARIF 2.1.0 alerts with locations, code flows, and rule help', async () => {
    const fixture = securityFixture('js-xss-escaping');
    const alerts = await parseSarifFile(path.join(fixture, 'results.sarif'));

    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({
      ruleId: 'js/xss-escaping',
      severity: 'error',
      scanner: 'CodeQL',
      message: 'User-controlled text is rendered as HTML without escaping.',
      locations: [{ uri: 'src/render.js', startLine: 1 }],
      cwe: 'CWE-79'
    });
    expect(alerts[0]?.codeFlows[0]?.locations[0]).toMatchObject({ uri: 'src/render.js', startLine: 2 });
    expect(alerts[0]?.ruleHelp).toContain('Escape HTML special characters');
  });

  test('selects alerts by rule id, severity, index, and maximum count', async () => {
    const alerts = await parseSarifFile(path.join(securityFixture('js-xss-escaping'), 'results.sarif'));
    const extra = { ...alerts[0]!, ruleId: 'other/rule', severity: 'warning' };

    expect(selectSarifAlerts([...alerts, extra], { ruleId: 'js/xss-escaping' })).toHaveLength(1);
    expect(selectSarifAlerts([...alerts, extra], { severity: 'warning' })).toEqual([extra]);
    expect(selectSarifAlerts([...alerts, extra], { alertIndex: 1 })).toEqual([extra]);
    expect(selectSarifAlerts([...alerts, extra], { maxAlerts: 1 })).toHaveLength(1);
  });

  test('rejects unsafe security patches that silence scanners or touch secrets', () => {
    expect(
      reviewSecurityPatchPolicy(`--- a/src/app.js\n+++ b/src/app.js\n@@ -1 +1 @@\n-const a = 1;\n+// eslint-disable-next-line security/detect-object-injection\n+const a = 1;\n`)
    ).toMatchObject({ approved: false, risk_level: 'high' });

    expect(
      reviewSecurityPatchPolicy(`--- a/.env\n+++ b/.env\n@@ -1 +1 @@\n-API_KEY=\n+API_KEY=placeholder\n`)
    ).toMatchObject({ approved: false, risk_level: 'high' });
  });

  test('builds a security-focused pull request body with alert metadata', async () => {
    const alert = (await parseSarifFile(path.join(securityFixture('js-xss-escaping'), 'results.sarif')))[0]!;
    const body = buildSecurityPrBody({
      alert,
      diagnosis: {
        summary: 'Escapes HTML before rendering.',
        rule_id: alert.ruleId,
        severity: alert.severity,
        cwe: alert.cwe,
        affected_files: ['src/render.js'],
        dataflow_summary: 'name flows into renderGreeting output',
        root_cause: 'Untrusted input was interpolated into HTML.',
        safe_fix_strategy: 'Escape special HTML characters.',
        confidence: 0.9,
        needs_human_review: true
      },
      changedFiles: ['src/render.js'],
      testsRun: ['node test.js'],
      validation: 'node test.js passed',
      metadata: {
        provider: 'deterministic',
        model: 'security-template',
        attempts: 1,
        sandbox: 'local'
      }
    });

    expect(body).toContain('## Security Alert');
    expect(body).toContain('js/xss-escaping');
    expect(body).toContain('## Safety Notes');
    expect(body).toContain('requires human review');
  });

  test.each([
    ['js-xss-escaping', 'node test.js'],
    ['js-path-traversal-normalization', 'node test.js'],
    ['js-hardcoded-secret-placeholder', 'node test.js'],
    ['py-sql-query-parameterization', 'python -m unittest test_app.py'],
    ['ts-unsafe-json-validation', 'node __DEVLOOP_ROOT__/node_modules/typescript/bin/tsc --noEmit']
  ])('fixes safe fixture %s', async (fixtureName, testCommand) => {
    const repoPath = await copyFixtureRepo(fixtureName);
    const sarifPath = path.join(repoPath, 'results.sarif');

    const dryRun = await runSecurityAutofix({
      repoPath,
      sarifPath,
      dryRun: true,
      maxAlerts: 1,
      testCommand,
      maxRetries: 1
    });
    expect(dryRun.results[0]).toMatchObject({ status: 'dry-run' });
    expect(dryRun.results[0]?.patch).toContain('--- a/');
    expect(dryRun.results[0]?.evidence?.runId).toMatch(/^run-/);

    const applied = await runSecurityAutofix({
      repoPath,
      sarifPath,
      dryRun: false,
      maxAlerts: 1,
      testCommand,
      maxRetries: 1
    });
    expect(applied.results[0]).toMatchObject({ status: 'fixed' });
    expect(applied.results[0]?.testResult?.passed).toBe(true);
    expect(applied.results[0]?.prBody).toContain('## Evidence Bundle');
  });
});

function securityFixture(name: string): string {
  return path.resolve('fixtures/security-sarif', name);
}

async function copyFixtureRepo(name: string): Promise<string> {
  const target = await mkdtemp(path.join(tmpdir(), `devloop-security-${name}-`));
  tempDirs.push(target);
  await cp(securityFixture(name), target, { recursive: true });
  await expect(readFile(path.join(target, 'expected-fix.md'), 'utf8')).resolves.toContain('Safe fix');
  return target;
}

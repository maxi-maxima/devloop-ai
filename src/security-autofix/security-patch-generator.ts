import { applyUnifiedDiff, previewPatch } from '../core/patcher.js';
import { runTestCommand } from '../core/test-runner.js';
import { PatchResult, TestResult } from '../core/types.js';
import { createPrFromLocalChanges } from '../core/git-workflow.js';
import { appendEvidenceSummary, createEvidenceBundle, updateEvidencePrBody } from '../evidence/index.js';
import type { RiskLevel } from '../firewall/types.js';
import { selectSarifAlerts, AlertSelectionOptions } from './alert-selector.js';
import { diagnoseSecurityAlert, SecurityDiagnosis } from './security-diagnoser.js';
import { reviewSecurityPatchPolicy, SecurityPatchReview } from './security-policy.js';
import { buildSecurityPrBody } from './security-pr-body.js';
import { parseSarifFile, SecurityAlert } from './sarif-parser.js';

export interface SecurityAutofixInput extends AlertSelectionOptions {
  repoPath: string;
  sarifPath: string;
  dryRun: boolean;
  onePrPerAlert?: boolean;
  testCommand?: string;
  maxRetries: number;
  provider?: string;
  model?: string;
  githubToken?: string;
}

export interface SecurityAutofixResult {
  alert: SecurityAlert;
  diagnosis: SecurityDiagnosis;
  status: 'dry-run' | 'fixed' | 'unsafe' | 'failed' | 'needs-human-review';
  attempts: number;
  patch?: string;
  patchPreview?: PatchResult;
  securityReview: SecurityPatchReview;
  testResult?: TestResult;
  prBody?: string;
  prUrl?: string;
  evidence?: {
    runId: string;
    path: string;
  };
  reason?: string;
}

export interface SecurityAutofixRunResult {
  results: SecurityAutofixResult[];
}

export async function runSecurityAutofix(input: SecurityAutofixInput): Promise<SecurityAutofixRunResult> {
  const alerts = selectSarifAlerts(await parseSarifFile(input.sarifPath), input);
  const results: SecurityAutofixResult[] = [];

  for (const alert of alerts) {
    results.push(
      await runOneAlert(
        {
          ...input,
          githubToken: input.onePrPerAlert ? input.githubToken : undefined
        },
        alert
      )
    );
  }

  if (input.githubToken && !input.onePrPerAlert) {
    const fixed = results.filter((result) => result.status === 'fixed');
    if (fixed.length > 0) {
      const pr = await createPrFromLocalChanges({
        repoPath: input.repoPath,
        token: input.githubToken,
        title: fixed.length === 1 ? 'fix(security): remediate SARIF alert with DevLoop' : 'fix(security): remediate SARIF alerts with DevLoop',
        body: combineSecurityPrBodies(fixed)
      });
      for (const result of fixed) {
        result.prUrl = pr.url;
      }
    }
  }

  return { results };
}

async function runOneAlert(input: SecurityAutofixInput, alert: SecurityAlert): Promise<SecurityAutofixResult> {
  const diagnosis = diagnoseSecurityAlert(alert);
  const patch = generateDeterministicSecurityPatch(alert.ruleId);
  const attempts = 1;
  const securityReview = reviewSecurityPatchPolicy(patch);

  if (patch.trim() === 'DEVLOOP_CANNOT_FIX_SAFELY') {
    return finalizeSecurityResult(input, {
      alert,
      diagnosis,
      status: 'needs-human-review',
      attempts,
      patch,
      securityReview,
      reason: 'No deterministic safe fix is available for this SARIF rule.'
    });
  }

  if (!securityReview.approved) {
    return finalizeSecurityResult(input, {
      alert,
      diagnosis,
      status: 'unsafe',
      attempts,
      patch,
      securityReview,
      reason: securityReview.reason
    });
  }

  const patchPreview = await previewPatch(input.repoPath, patch);
  if (!patchPreview.safety.passed) {
    return finalizeSecurityResult(input, {
      alert,
      diagnosis,
      status: 'unsafe',
      attempts,
      patch,
      patchPreview,
      securityReview: {
        approved: false,
        risk_level: 'high',
        issues: patchPreview.safety.errors,
        reason: patchPreview.safety.errors.join('\n')
      },
      reason: patchPreview.safety.errors.join('\n')
    });
  }

  if (input.dryRun) {
    return finalizeSecurityResult(input, {
      alert,
      diagnosis,
      status: 'dry-run',
      attempts,
      patch,
      patchPreview,
      securityReview
    });
  }

  await applyUnifiedDiff(input.repoPath, patch);
  const testResult = input.testCommand
    ? await runTestCommand(input.repoPath, input.testCommand.replaceAll('__DEVLOOP_ROOT__', process.cwd()))
    : undefined;
  if (testResult && !testResult.passed) {
    return finalizeSecurityResult(input, {
      alert,
      diagnosis,
      status: 'failed',
      attempts,
      patch,
      patchPreview,
      securityReview,
      testResult,
      reason: 'Validation test command failed.'
    });
  }

  const prBody = buildSecurityPrBody({
    alert,
    diagnosis,
    changedFiles: patchPreview.changedFiles,
    testsRun: input.testCommand ? [input.testCommand] : [],
    validation: testResult ?? 'No test command provided.',
    metadata: {
      provider: input.provider ?? 'deterministic',
      model: input.model ?? 'security-template',
      attempts,
      sandbox: 'local'
    }
  });

  const result = await finalizeSecurityResult(input, {
    alert,
    diagnosis,
    status: 'fixed',
    attempts,
    patch,
    patchPreview,
    securityReview,
    testResult,
    prBody
  });

  let prUrl: string | undefined;
  if (input.githubToken) {
    const pr = await createPrFromLocalChanges({
      repoPath: input.repoPath,
      token: input.githubToken,
      title: 'fix(security): remediate SARIF alert with DevLoop',
      body: result.prBody ?? prBody
    });
    prUrl = pr.url;
  }

  return {
    ...result,
    prUrl
  };
}

async function finalizeSecurityResult(
  input: SecurityAutofixInput,
  result: SecurityAutofixResult
): Promise<SecurityAutofixResult> {
  const riskLevel = securityRiskLevel(result);
  const testAfterLog = result.testResult ? [result.testResult.stdout, result.testResult.stderr].join('\n') : '';
  const evidence = await createEvidenceBundle({
    repoPath: input.repoPath,
    trigger: {
      type: input.dryRun ? 'security-autofix.dry_run' : 'security-autofix'
    },
    model: {
      provider: input.provider ?? 'deterministic',
      model: input.model ?? 'security-template'
    },
    sandbox: {
      runner: 'local',
      network: 'disabled',
      secretsMounted: false,
      timeoutSeconds: 120,
      user: process.env.USERNAME ?? process.env.USER ?? 'unknown'
    },
    diagnosis: {
      summary: result.diagnosis.summary,
      confidence: result.diagnosis.confidence,
      likelyFiles: result.diagnosis.affected_files
    },
    patch: result.patch ?? '',
    testBeforeLog: JSON.stringify({ alert: result.alert, diagnosis: result.diagnosis }, null, 2),
    testAfterLog,
    validationCommands: result.testResult
      ? [
          {
            command: result.testResult.command,
            exitCode: result.testResult.exitCode,
            durationMs: result.testResult.durationMs,
            passed: result.testResult.passed,
            logName: 'test-after.log'
          }
        ]
      : [],
    firewall: {
      decision: riskLevel === 'high' || riskLevel === 'critical' ? 'block' : 'allow',
      riskLevel,
      findingsCount: result.securityReview.issues.length + (result.patchPreview?.safety.errors.length ?? 0)
    },
    prBody: result.prBody,
    metadata: {
      alertRuleId: result.alert.ruleId,
      alertSeverity: result.alert.severity,
      attempts: result.attempts,
      status: result.status
    }
  });

  const reference = { runId: evidence.runId, path: evidence.path };
  if (!result.prBody) {
    return { ...result, evidence: reference };
  }

  const prBody = appendEvidenceSummary(result.prBody, {
    runId: evidence.runId,
    path: evidence.path,
    riskLevel: evidence.bundle.patch.riskLevel,
    sandboxMode: evidence.bundle.sandbox.runner,
    testCommand: input.testCommand,
    humanReviewRequired: evidence.bundle.safety.humanReviewRequired
  });
  await updateEvidencePrBody(evidence.path, prBody);
  return { ...result, evidence: reference, prBody };
}

function securityRiskLevel(result: SecurityAutofixResult): RiskLevel {
  if (!result.securityReview.approved || result.status === 'unsafe' || result.status === 'needs-human-review') {
    return 'high';
  }
  if (result.testResult && !result.testResult.passed) {
    return 'medium';
  }
  return result.securityReview.risk_level;
}

function generateDeterministicSecurityPatch(ruleId: string): string {
  switch (ruleId) {
    case 'js/xss-escaping':
      return `--- a/src/render.js
+++ b/src/render.js
@@ -1,5 +1,9 @@
+function escapeHtml(value) {
+  return String(value).replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char]);
+}
+
 function renderGreeting(name) {
-  return \`<h1>Hello \${name}</h1>\`;
+  return \`<h1>Hello \${escapeHtml(name)}</h1>\`;
 }
 
 module.exports = { renderGreeting };
`;
    case 'js/path-traversal-normalization':
      return `--- a/src/files.js
+++ b/src/files.js
@@ -3,7 +3,11 @@
 const ROOT = path.join(__dirname, '..', 'public');
 
 function resolvePublicPath(userPath) {
-  return path.join(ROOT, userPath);
+  const resolved = path.resolve(ROOT, userPath);
+  if (resolved !== ROOT && !resolved.startsWith(ROOT + path.sep)) {
+    throw new Error('Invalid public path');
+  }
+  return resolved;
 }
 
 module.exports = { ROOT, resolvePublicPath };
`;
    case 'js/hardcoded-secret-placeholder':
      return `--- a/src/config.js
+++ b/src/config.js
@@ -1,7 +1,5 @@
-const API_KEY = 'dev-secret-placeholder';
-
 function getApiKey(env = process.env) {
-  return API_KEY || env.API_KEY;
+  return env.API_KEY ?? '';
 }
 
 module.exports = { getApiKey };
`;
    case 'py/sql-query-parameterization':
      return `--- a/app.py
+++ b/app.py
@@ -1,2 +1,2 @@
 def find_user(db, user_id):
-    return db.execute(f"SELECT * FROM users WHERE id = {user_id}")
+    return db.execute("SELECT * FROM users WHERE id = ?", (user_id,))
`;
    case 'ts/unsafe-json-validation':
      return `--- a/src/index.ts
+++ b/src/index.ts
@@ -2,6 +2,14 @@
   enabled: boolean;
 }
 
 export function parseSettings(text: string): Settings {
-  return JSON.parse(text) as Settings;
+  const value = JSON.parse(text) as unknown;
+  if (
+    typeof value !== 'object' ||
+    value === null ||
+    typeof (value as { enabled?: unknown }).enabled !== 'boolean'
+  ) {
+    throw new Error('Invalid settings');
+  }
+  return value as Settings;
 }
`;
    default:
      return 'DEVLOOP_CANNOT_FIX_SAFELY';
  }
}

function combineSecurityPrBodies(results: SecurityAutofixResult[]): string {
  if (results.length === 1) {
    return results[0]?.prBody ?? 'Security fix generated by DevLoop AI.';
  }

  return [
    '## Security Autofix Summary',
    `DevLoop remediated ${results.length} SARIF alerts in this patch set.`,
    '',
    ...results.flatMap((result, index) => [
      `## Alert ${index + 1}: ${result.alert.ruleId}`,
      result.prBody ?? 'Security fix generated by DevLoop AI.',
      ''
    ])
  ].join('\n');
}

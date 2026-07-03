import { readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { AiProvider } from '../ai/providers/index.js';
import { buildGeneratePatchPrompt } from '../ai/ci-prompts.js';
import { generatePrBody } from '../github/pr-body.js';
import {
  appendEvidenceSummary,
  createEvidenceBundle,
  updateEvidencePrBody,
  type EvidenceBundle
} from '../evidence/index.js';
import type { FirewallDecision, RiskLevel } from '../firewall/types.js';
import { diagnoseCiFailure } from './diagnoser.js';
import { buildRelevantContext } from './context-builder.js';
import { applyUnifiedDiff, previewPatch } from './patcher.js';
import { runTestCommand } from './test-runner.js';
import { AutoFixResult, Diagnosis, SafetyCheckResult, TestResult } from './types.js';

export interface AutoFixInput {
  repoPath: string;
  log: string;
  testCommand: string;
  maxRetries: number;
  dryRun: boolean;
  noPr: boolean;
  provider: AiProvider;
  allowLockfile?: boolean;
  maxFiles?: number;
  timeoutMs?: number;
  evidenceRoot?: string;
  evidenceTrigger?: Partial<EvidenceBundle['trigger']>;
}

export async function runAutoFix(input: AutoFixInput): Promise<AutoFixResult> {
  let log = input.log;
  let latestDiagnosis: Diagnosis | undefined;
  let latestPatch = '';
  let latestSafety = emptySafety();
  let latestTestResult: TestResult | undefined;
  let changedFiles: string[] = [];

  for (let attempt = 1; attempt <= input.maxRetries; attempt += 1) {
    latestDiagnosis = await diagnoseCiFailure({ log, repoPath: input.repoPath });
    const context = await buildRelevantContext(input.repoPath, latestDiagnosis);
    latestPatch = await input.provider.complete(await buildGeneratePatchPrompt(latestDiagnosis, context));
    const preview = await previewPatch(input.repoPath, latestPatch, {
      allowLockfile: input.allowLockfile,
      maxFiles: input.maxFiles
    });
    latestSafety = preview.safety;
    changedFiles = preview.changedFiles;

    if (!preview.safety.passed) {
      return finalizeAutoFix(input, {
        status: 'unsafe',
        attempts: attempt,
        diagnosis: latestDiagnosis,
        patch: latestPatch,
        changedFiles,
        safety: preview.safety,
        reason: preview.safety.errors.join('\n')
      });
    }

    if (input.dryRun) {
      return finalizeAutoFix(input, {
        status: 'dry-run',
        attempts: attempt,
        diagnosis: latestDiagnosis,
        patch: latestPatch,
        changedFiles,
        safety: preview.safety
      });
    }

    const backup = await backupFiles(input.repoPath, changedFiles);
    await applyUnifiedDiff(input.repoPath, latestPatch, {
      allowLockfile: input.allowLockfile,
      maxFiles: input.maxFiles
    });

    latestTestResult = await runTestCommand(input.repoPath, input.testCommand, input.timeoutMs);
    if (latestTestResult.passed) {
      const prBody = generatePrBody({
        summary: latestDiagnosis.summary,
        rootCause: latestDiagnosis.root_cause_hypothesis,
        fixSummary: latestDiagnosis.recommended_fix_strategy,
        changedFiles,
        testResult: latestTestResult,
        safety: latestSafety,
        metadata: {
          attempts: attempt,
          provider: input.provider.name,
          model: input.provider.model,
          dryRun: input.dryRun
        }
      });

      return finalizeAutoFix(input, {
        status: 'fixed',
        attempts: attempt,
        diagnosis: latestDiagnosis,
        patch: latestPatch,
        changedFiles,
        safety: latestSafety,
        testResult: latestTestResult,
        prBody
      });
    }

    await restoreFiles(input.repoPath, backup);
    log = [log, 'Latest test failure after generated patch:', latestTestResult.stderr, latestTestResult.stdout].join(
      '\n'
    );
  }

  return finalizeAutoFix(input, {
    status: 'failed',
    attempts: input.maxRetries,
    diagnosis: latestDiagnosis ?? (await diagnoseCiFailure({ log, repoPath: input.repoPath })),
    patch: latestPatch,
    changedFiles,
    safety: latestSafety,
    testResult: latestTestResult,
    reason: 'Maximum retry limit reached.'
  });
}

async function finalizeAutoFix(input: AutoFixInput, result: AutoFixResult): Promise<AutoFixResult> {
  const testAfterLog = result.testResult ? [result.testResult.stdout, result.testResult.stderr].join('\n') : '';
  const evidence = await createEvidenceBundle({
    repoPath: input.repoPath,
    evidenceRoot: input.evidenceRoot,
    trigger: {
      ...input.evidenceTrigger,
      type: input.evidenceTrigger?.type ?? (input.dryRun ? 'autofix.dry_run' : 'autofix')
    },
    model: {
      provider: input.provider.name,
      model: input.provider.model
    },
    sandbox: {
      runner: 'local',
      network: 'disabled',
      secretsMounted: false,
      timeoutSeconds: Math.ceil((input.timeoutMs ?? 120_000) / 1000),
      user: process.env.USERNAME ?? process.env.USER ?? 'unknown'
    },
    diagnosis: {
      summary: result.diagnosis.summary,
      confidence: result.diagnosis.confidence,
      likelyFiles: result.diagnosis.likely_files
    },
    patch: result.patch ?? '',
    testBeforeLog: input.log,
    testAfterLog,
    validationCommands: [
      {
        command: result.diagnosis.failing_command || input.testCommand,
        exitCode: 1,
        durationMs: 0,
        passed: false,
        logName: 'test-before.log'
      },
      ...(result.testResult
        ? [
            {
              command: result.testResult.command,
              exitCode: result.testResult.exitCode,
              durationMs: result.testResult.durationMs,
              passed: result.testResult.passed,
              logName: 'test-after.log'
            }
          ]
        : [])
    ],
    firewall: {
      decision: firewallDecisionFromSafety(result.safety),
      riskLevel: riskFromSafety(result.safety),
      findingsCount: result.safety.errors.length + result.safety.warnings.length
    },
    prBody: result.prBody,
    metadata: {
      attempts: result.attempts,
      status: result.status,
      noPr: input.noPr
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

function firewallDecisionFromSafety(safety: SafetyCheckResult): FirewallDecision {
  if (!safety.passed) {
    return 'block';
  }
  return safety.warnings.length > 0 ? 'require_human_approval' : 'allow';
}

function riskFromSafety(safety: SafetyCheckResult): RiskLevel {
  if (!safety.passed || safety.forbiddenFiles.length > 0) {
    return 'high';
  }
  return safety.warnings.length > 0 ? 'medium' : 'low';
}

async function backupFiles(repoPath: string, files: string[]): Promise<Map<string, string | undefined>> {
  const backup = new Map<string, string | undefined>();
  for (const file of files) {
    const fullPath = path.join(repoPath, file);
    const content = await readFile(fullPath, 'utf8').catch(() => undefined);
    backup.set(file, content);
  }

  return backup;
}

async function restoreFiles(repoPath: string, backup: Map<string, string | undefined>): Promise<void> {
  for (const [file, content] of backup) {
    const fullPath = path.join(repoPath, file);
    if (content === undefined) {
      await rm(fullPath, { force: true });
    } else {
      await writeFile(fullPath, content, 'utf8');
    }
  }
}

function emptySafety(): SafetyCheckResult {
  return {
    passed: false,
    errors: [],
    warnings: [],
    changedFiles: [],
    forbiddenFiles: []
  };
}

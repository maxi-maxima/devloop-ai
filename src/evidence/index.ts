import { cp, mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { redactSecrets } from '../firewall/index.js';
import type { RiskLevel } from '../firewall/types.js';
import { createRunId, sha256 } from './hash.js';
import type {
  CreateEvidenceBundleInput,
  EvidenceBundle,
  EvidenceBundleWriteResult,
  EvidenceExportInput,
  EvidenceExportResult,
  EvidenceSummary,
  EvidenceVerificationResult
} from './types.js';
import { createZip } from './zip.js';

export type * from './types.js';

export async function createEvidenceBundle(input: CreateEvidenceBundleInput): Promise<EvidenceBundleWriteResult> {
  const runId = input.runId ?? createRunId();
  const evidenceRoot = input.evidenceRoot ?? path.join(input.repoPath, '.devloop', 'evidence');
  const bundlePath = path.join(evidenceRoot, runId);
  await mkdir(bundlePath, { recursive: true });

  const patch = redactSecrets(input.patch ?? '', 'repository_file').redactedText;
  const testBeforeLog = redactSecrets(input.testBeforeLog ?? '', 'ci_log').redactedText;
  const testAfterLog = redactSecrets(input.testAfterLog ?? '', 'test_output').redactedText;
  const prBody = redactSecrets(input.prBody ?? '', 'system_config').redactedText;
  const firewall = input.firewall ?? { decision: 'allow' as const, riskLevel: 'low' as const, findingsCount: 0 };
  const patchStats = summarizePatch(patch);
  const validationCommands = (input.validationCommands ?? []).map((command) => ({
    command: command.command,
    exitCode: command.exitCode ?? -1,
    durationMs: command.durationMs,
    passed: command.passed,
    logSha256: sha256(command.logName === 'test-after.log' ? testAfterLog : testBeforeLog)
  }));
  const safety = inferSafety(patch, firewall.riskLevel);
  const bundle: EvidenceBundle = {
    schemaVersion: '1.0.0',
    runId,
    createdAt: new Date().toISOString(),
    devloopVersion: await devloopVersion(input.repoPath),
    trigger: input.trigger,
    model: input.model,
    sandbox: input.sandbox,
    diagnosis: input.diagnosis,
    patch: {
      filesChanged: patchStats.filesChanged,
      linesAdded: patchStats.linesAdded,
      linesDeleted: patchStats.linesDeleted,
      riskLevel: maxRisk(
        firewall.riskLevel,
        safety.forbiddenFilesTouched ||
          safety.workflowPermissionsChanged ||
          safety.secretsDetected ||
          safety.testsDeleted
          ? 'high'
          : 'low'
      ),
      sha256: sha256(patch)
    },
    validation: {
      commands: validationCommands
    },
    firewall,
    safety
  };

  await Promise.all([
    writeJson(path.join(bundlePath, 'evidence.json'), bundle),
    writeJson(path.join(bundlePath, 'diagnosis.json'), input.diagnosis),
    writeJson(path.join(bundlePath, 'firewall-report.json'), firewall),
    writeFile(path.join(bundlePath, 'patch.diff'), patch, 'utf8'),
    writeFile(path.join(bundlePath, 'test-before.log'), testBeforeLog, 'utf8'),
    writeFile(path.join(bundlePath, 'test-after.log'), testAfterLog, 'utf8'),
    writeJson(path.join(bundlePath, 'sandbox.json'), input.sandbox),
    writeFile(path.join(bundlePath, 'pr-body.md'), prBody, 'utf8'),
    writeJson(path.join(bundlePath, 'metadata.json'), {
      runId,
      trigger: input.trigger,
      model: input.model,
      metadata: input.metadata ?? {}
    })
  ]);

  return { runId, path: bundlePath, bundle };
}

export async function updateEvidencePrBody(bundlePath: string, prBody: string): Promise<void> {
  await writeFile(path.join(bundlePath, 'pr-body.md'), redactSecrets(prBody, 'system_config').redactedText, 'utf8');
}

export async function verifyEvidenceBundle(bundlePath: string): Promise<EvidenceVerificationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const requiredFiles = [
    'evidence.json',
    'diagnosis.json',
    'firewall-report.json',
    'patch.diff',
    'test-before.log',
    'test-after.log',
    'sandbox.json',
    'pr-body.md',
    'metadata.json'
  ];
  for (const file of requiredFiles) {
    if (!(await exists(path.join(bundlePath, file)))) {
      errors.push(`missing required file: ${file}`);
    }
  }

  const bundle = await readJson<EvidenceBundle>(path.join(bundlePath, 'evidence.json')).catch((error: unknown) => {
    errors.push(`invalid evidence.json: ${error instanceof Error ? error.message : String(error)}`);
    return undefined;
  });
  if (!bundle) {
    return { valid: false, errors, warnings };
  }

  errors.push(...validateEvidenceSchema(bundle));
  const patch = await readFile(path.join(bundlePath, 'patch.diff'), 'utf8').catch(() => undefined);
  if (patch !== undefined && sha256(patch) !== bundle.patch.sha256) {
    errors.push('patch.diff sha256 mismatch');
  }

  const before = await readFile(path.join(bundlePath, 'test-before.log'), 'utf8').catch(() => undefined);
  const after = await readFile(path.join(bundlePath, 'test-after.log'), 'utf8').catch(() => undefined);
  bundle.validation.commands.forEach((command, index) => {
    const logText = index === 0 ? before : after;
    if (logText !== undefined && command.logSha256 !== sha256(logText)) {
      errors.push(`validation log ${index + 1} sha256 mismatch`);
    }
  });

  return { valid: errors.length === 0, errors, warnings, bundle };
}

export async function exportEvidenceBundle(input: EvidenceExportInput): Promise<EvidenceExportResult> {
  const evidenceRoot = input.evidenceRoot ?? path.resolve('.devloop', 'evidence');
  const bundlePath = path.join(evidenceRoot, input.runId);
  const outputDir = input.outputDir ?? process.cwd();
  await mkdir(outputDir, { recursive: true });

  if (input.format === 'json') {
    const outputPath = path.join(outputDir, `devloop-evidence-${input.runId}.json`);
    await cp(path.join(bundlePath, 'evidence.json'), outputPath);
    return { outputPath, format: input.format };
  }

  if (input.format === 'markdown') {
    const outputPath = path.join(outputDir, `devloop-evidence-${input.runId}.md`);
    const verification = await verifyEvidenceBundle(bundlePath);
    await writeFile(outputPath, renderEvidenceMarkdown(verification.bundle!, verification), 'utf8');
    return { outputPath, format: input.format };
  }

  const outputPath = path.join(outputDir, `devloop-evidence-${input.runId}.zip`);
  const entries = await Promise.all(
    (await readdir(bundlePath)).map(async (name) => ({
      name,
      data: await readFile(path.join(bundlePath, name))
    }))
  );
  await writeFile(outputPath, createZip(entries));
  return { outputPath, format: input.format };
}

export function appendEvidenceSummary(prBody: string, summary: EvidenceSummary): string {
  return [
    prBody.trimEnd(),
    '',
    '## Evidence Bundle',
    '',
    `- Run ID: ${summary.runId}`,
    `- Risk level: ${summary.riskLevel}`,
    `- Sandbox mode: ${summary.sandboxMode}`,
    summary.testCommand ? `- Test command: \`${summary.testCommand}\`` : '- Test command: not provided',
    `- Evidence file path or artifact link: ${summary.path}`,
    `- Human review required: ${summary.humanReviewRequired ? 'yes' : 'no'}`
  ].join('\n');
}

export function renderEvidenceMarkdown(bundle: EvidenceBundle, verification?: EvidenceVerificationResult): string {
  return [
    '# DevLoop Evidence Bundle',
    '',
    `Run ID: ${bundle.runId}`,
    `Created: ${bundle.createdAt}`,
    `DevLoop version: ${bundle.devloopVersion}`,
    `Trigger: ${bundle.trigger.type}`,
    '',
    '## Diagnosis',
    '',
    bundle.diagnosis.summary,
    '',
    '## Patch',
    '',
    `- Files changed: ${bundle.patch.filesChanged.join(', ') || 'none'}`,
    `- Lines added: ${bundle.patch.linesAdded}`,
    `- Lines deleted: ${bundle.patch.linesDeleted}`,
    `- Risk: ${bundle.patch.riskLevel}`,
    `- SHA-256: ${bundle.patch.sha256}`,
    '',
    '## Validation',
    '',
    ...bundle.validation.commands.map(
      (command) => `- \`${command.command}\`: ${command.passed ? 'passed' : 'failed'} (${command.exitCode})`
    ),
    '',
    '## Firewall',
    '',
    `- Decision: ${bundle.firewall.decision}`,
    `- Risk: ${bundle.firewall.riskLevel}`,
    `- Findings: ${bundle.firewall.findingsCount}`,
    '',
    '## Verification',
    '',
    verification ? `- Valid: ${verification.valid ? 'yes' : 'no'}` : '- Valid: not checked'
  ].join('\n');
}

function summarizePatch(patch: string): { filesChanged: string[]; linesAdded: number; linesDeleted: number } {
  const files = new Set<string>();
  let linesAdded = 0;
  let linesDeleted = 0;
  for (const line of patch.split(/\r?\n/)) {
    const fileMatch = line.match(/^\+\+\+ b\/(.+)$/);
    if (fileMatch) {
      files.add(fileMatch[1]!);
    }
    if (line.startsWith('+') && !line.startsWith('+++')) {
      linesAdded += 1;
    }
    if (line.startsWith('-') && !line.startsWith('---')) {
      linesDeleted += 1;
    }
  }
  return { filesChanged: [...files], linesAdded, linesDeleted };
}

function inferSafety(patch: string, _firewallRisk: RiskLevel): EvidenceBundle['safety'] {
  return {
    forbiddenFilesTouched: /(?:^|\n)(?:---|\+\+\+) [ab]\/(?:\.env|.*\.(?:pem|key)|.*\/\.npmrc)/.test(patch),
    workflowPermissionsChanged: /^(\+).*permissions\s*:|contents:\s*write|write-all/im.test(patch),
    secretsDetected: redactSecrets(patch, 'repository_file').findings.length > 0,
    testsDeleted: /deleted file mode[\s\S]*(?:test|tests|__tests__|\.test\.|\.spec\.)/i.test(patch),
    humanReviewRequired: true
  };
}

function maxRisk(a: RiskLevel, b: RiskLevel): RiskLevel {
  const order: RiskLevel[] = ['low', 'medium', 'high', 'critical'];
  return order.indexOf(a) > order.indexOf(b) ? a : b;
}

function validateEvidenceSchema(bundle: EvidenceBundle): string[] {
  const errors: string[] = [];
  for (const key of ['schemaVersion', 'runId', 'createdAt', 'devloopVersion'] as const) {
    if (typeof bundle[key] !== 'string' || bundle[key].length === 0) {
      errors.push(`evidence.${key} is required`);
    }
  }
  if (!bundle.trigger?.type) errors.push('evidence.trigger.type is required');
  if (!bundle.model?.provider || !bundle.model?.model) errors.push('evidence.model provider and model are required');
  if (!bundle.sandbox?.runner) errors.push('evidence.sandbox.runner is required');
  if (!bundle.diagnosis?.summary) errors.push('evidence.diagnosis.summary is required');
  if (!bundle.patch?.sha256) errors.push('evidence.patch.sha256 is required');
  if (!Array.isArray(bundle.validation?.commands)) errors.push('evidence.validation.commands must be an array');
  if (!bundle.firewall?.decision) errors.push('evidence.firewall.decision is required');
  return errors;
}

async function writeJson(file: string, value: unknown): Promise<void> {
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(file, 'utf8')) as T;
}

async function exists(file: string): Promise<boolean> {
  return stat(file).then(() => true, () => false);
}

async function devloopVersion(_repoPath: string): Promise<string> {
  const root = await readJson<{ version?: string }>(path.resolve('package.json')).catch(() => undefined);
  return root?.version ?? '0.0.0';
}

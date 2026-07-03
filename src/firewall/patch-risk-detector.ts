import { defaultFirewallPolicy } from './policies/default-policy.js';
import { authSensitivePathPattern, forbiddenSecretFilePatterns, testFilePattern } from './rules/patch-rules.js';
import { resultFromFindings } from './risk-score.js';
import { excerpt, redactSecrets } from './redactor.js';
import type { CheckPatchInput, FirewallFinding, FirewallPolicy } from './types.js';

interface ParsedPatch {
  files: string[];
  addedLines: { file: string; line: string }[];
  removedLines: { file: string; line: string }[];
  deletedFiles: string[];
}

export function checkPatchRisk(input: CheckPatchInput, policy: FirewallPolicy = defaultFirewallPolicy()) {
  const redactedPatch = redactSecrets(input.patch, 'repository_file').redactedText;
  const parsed = parsePatch(redactedPatch);
  const findings: FirewallFinding[] = [];

  if (parsed.files.length > policy.maxPatchFiles) {
    findings.push(finding('patch.too-many-files', 'high', `Patch touches ${parsed.files.length} files.`, parsed.files.join(', '), 'Split the change or request human approval.'));
  }

  for (const file of parsed.files) {
    if (forbiddenSecretFilePatterns.some((pattern) => pattern.test(file))) {
      findings.push(finding('patch.secret-file', 'critical', `Patch edits secret-bearing file: ${file}`, file, 'Never edit .env, private key, npmrc, or credential files from an autonomous patch.'));
    }
    if (/^\.github\/workflows\//.test(file) && !policy.allowWorkflowPermissionChanges) {
      const permissionLine = parsed.addedLines.find((line) => line.file === file && /\bpermissions\s*:|contents:\s*write|write-all|id-token:\s*write/i.test(line.line));
      if (permissionLine) {
        findings.push(finding('patch.workflow-permissions', 'high', 'Patch changes GitHub Actions workflow permissions.', `${file}: ${permissionLine.line}`, 'Require human approval for workflow permission changes.'));
      }
    }
    if (authSensitivePathPattern.test(file)) {
      findings.push(finding('patch.auth-sensitive-file', 'medium', `Patch touches auth or permission-sensitive file: ${file}`, file, 'Require careful review of authorization and validation behavior.'));
    }
  }

  for (const file of parsed.deletedFiles) {
    if (testFilePattern.test(file)) {
      findings.push(finding('patch.deletes-tests', 'critical', `Patch deletes test file: ${file}`, file, 'Do not delete tests to make CI pass.'));
    }
  }

  for (const added of parsed.addedLines) {
    if (testFilePattern.test(added.file) && /\b(?:describe|it|test)\.skip\b|\bx(?:describe|it)\s*\(|pytest\.mark\.skip|@pytest\.mark\.skip/i.test(added.line)) {
      findings.push(finding('patch.disables-tests', 'critical', 'Patch disables tests.', `${added.file}: ${added.line}`, 'Fix the root cause instead of skipping tests.'));
    }
    if (added.file.endsWith('package.json') && /"(preinstall|install|postinstall|prepare)"\s*:/i.test(added.line)) {
      findings.push(finding('patch.lifecycle-script', 'high', 'Patch adds or edits package manager lifecycle scripts.', `${added.file}: ${added.line}`, 'Require human approval for lifecycle scripts because they run during install.'));
    }
    if (/\b(curl|wget|Invoke-WebRequest|iwr)\b|https?:\/\/|fetch\s*\(|axios\.|http\.get\s*\(|https\.get\s*\(/i.test(added.line)) {
      findings.push(finding('patch.network-call', 'high', 'Patch adds network access.', `${added.file}: ${added.line}`, 'Require human review for new network calls.'));
    }
    if (/\beval\s*\(|new\s+Function\s*\(|child_process|exec\s*\(|spawn\s*\(|system\s*\(/i.test(added.line)) {
      findings.push(finding('patch.code-execution', 'critical', 'Patch adds dynamic code or shell execution.', `${added.file}: ${added.line}`, 'Block dynamic execution unless explicitly reviewed.'));
    }
    if (/eslint-disable|nosemgrep|semgrep:\s*ignore|codeql.*disable|bandit:\s*skip|gosec.*ignore/i.test(added.line)) {
      findings.push(finding('patch.scanner-suppression', 'high', 'Patch suppresses lint or security scanner warnings.', `${added.file}: ${added.line}`, 'Fix the root cause instead of suppressing scanners.'));
    }
  }

  for (const removed of parsed.removedLines) {
    if (/\b(validate|validation|sanitize|schema|authorize|permission|csrf|escape)\b/i.test(removed.line)) {
      findings.push(finding('patch.removes-validation', 'high', 'Patch removes validation, sanitization, or authorization logic.', `${removed.file}: ${removed.line}`, 'Require human review for validation or authorization changes.'));
    }
    if (/\b(npm|pnpm|yarn)\s+run\s+(lint|typecheck|test)\b|\b(pytest|go test|cargo test|mypy|ruff|eslint|tsc)\b/i.test(removed.line)) {
      findings.push(finding('patch.removes-ci-check', 'critical', 'Patch removes lint, type check, or test execution.', `${removed.file}: ${removed.line}`, 'Fix the root cause instead of removing validation checks.'));
    }
  }

  const redaction = redactSecrets(input.patch, 'repository_file');
  findings.push(...redaction.findings);

  return resultFromFindings(findings, policy, redactedPatch);
}

function parsePatch(patch: string): ParsedPatch {
  const files = new Set<string>();
  const deletedFiles: string[] = [];
  const addedLines: ParsedPatch['addedLines'] = [];
  const removedLines: ParsedPatch['removedLines'] = [];
  let currentFile = '';
  let pendingDeleted = false;

  for (const rawLine of patch.split(/\r?\n/)) {
    const diffMatch = rawLine.match(/^diff --git a\/(.+?) b\/(.+)$/);
    if (diffMatch) {
      currentFile = normalizePatchPath(diffMatch[2]!);
      files.add(currentFile);
      pendingDeleted = false;
      continue;
    }

    if (rawLine.startsWith('deleted file mode')) {
      pendingDeleted = true;
      continue;
    }

    const newFileMatch = rawLine.match(/^\+\+\+ b\/(.+)$/);
    if (newFileMatch) {
      currentFile = normalizePatchPath(newFileMatch[1]!);
      files.add(currentFile);
      if (pendingDeleted) {
        deletedFiles.push(currentFile);
      }
      continue;
    }

    if (rawLine.startsWith('+++ /dev/null') && currentFile) {
      deletedFiles.push(currentFile);
      continue;
    }

    if (!currentFile) {
      continue;
    }

    if (rawLine.startsWith('+') && !rawLine.startsWith('+++')) {
      addedLines.push({ file: currentFile, line: rawLine.slice(1) });
    } else if (rawLine.startsWith('-') && !rawLine.startsWith('---')) {
      removedLines.push({ file: currentFile, line: rawLine.slice(1) });
    }
  }

  return { files: [...files], addedLines, removedLines, deletedFiles };
}

function normalizePatchPath(file: string): string {
  return file.replace(/\\/g, '/');
}

function finding(
  id: string,
  severity: FirewallFinding['severity'],
  message: string,
  evidence: string,
  recommendation: string
): FirewallFinding {
  return {
    id,
    category: 'unsafe_patch',
    severity,
    source: 'repository_file',
    message,
    evidence: excerpt(evidence),
    recommendation
  };
}

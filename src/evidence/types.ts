import type { FirewallDecision, RiskLevel } from '../firewall/types.js';

export type EvidenceSandboxRunner = 'docker' | 'local' | 'github-actions';
export type EvidenceNetworkMode = 'disabled' | 'enabled';

export interface EvidenceBundle {
  schemaVersion: string;
  runId: string;
  createdAt: string;
  devloopVersion: string;
  trigger: {
    type: string;
    repository?: string;
    workflowRunUrl?: string;
    pullRequestUrl?: string;
    commitSha?: string;
    actor?: string;
  };
  model: {
    provider: string;
    model: string;
    temperature?: number;
  };
  sandbox: {
    runner: EvidenceSandboxRunner;
    network: EvidenceNetworkMode;
    secretsMounted: boolean;
    timeoutSeconds: number;
    user: string;
  };
  diagnosis: {
    summary: string;
    confidence: number;
    likelyFiles: string[];
  };
  patch: {
    filesChanged: string[];
    linesAdded: number;
    linesDeleted: number;
    riskLevel: RiskLevel;
    sha256: string;
  };
  validation: {
    commands: Array<{
      command: string;
      exitCode: number;
      durationMs: number;
      passed: boolean;
      logSha256: string;
    }>;
  };
  firewall: {
    decision: FirewallDecision;
    riskLevel: RiskLevel;
    findingsCount: number;
  };
  safety: {
    forbiddenFilesTouched: boolean;
    workflowPermissionsChanged: boolean;
    secretsDetected: boolean;
    testsDeleted: boolean;
    humanReviewRequired: boolean;
  };
}

export interface EvidenceValidationCommandInput {
  command: string;
  exitCode: number | null;
  durationMs: number;
  passed: boolean;
  logName: 'test-before.log' | 'test-after.log' | string;
}

export interface CreateEvidenceBundleInput {
  repoPath: string;
  evidenceRoot?: string;
  runId?: string;
  trigger: EvidenceBundle['trigger'];
  model: EvidenceBundle['model'];
  sandbox: EvidenceBundle['sandbox'];
  diagnosis: EvidenceBundle['diagnosis'];
  patch?: string;
  testBeforeLog?: string;
  testAfterLog?: string;
  validationCommands?: EvidenceValidationCommandInput[];
  firewall?: EvidenceBundle['firewall'];
  prBody?: string;
  metadata?: Record<string, unknown>;
}

export interface EvidenceBundleWriteResult {
  runId: string;
  path: string;
  bundle: EvidenceBundle;
}

export interface EvidenceVerificationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  bundle?: EvidenceBundle;
}

export type EvidenceExportFormat = 'json' | 'zip' | 'markdown';

export interface EvidenceExportInput {
  runId: string;
  evidenceRoot?: string;
  outputDir?: string;
  format: EvidenceExportFormat;
}

export interface EvidenceExportResult {
  outputPath: string;
  format: EvidenceExportFormat;
}

export interface EvidenceSummary {
  runId: string;
  path: string;
  riskLevel: RiskLevel;
  sandboxMode: EvidenceSandboxRunner;
  testCommand?: string;
  humanReviewRequired: boolean;
}

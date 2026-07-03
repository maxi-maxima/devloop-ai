export interface Diagnosis {
  summary: string;
  failing_command: string;
  failing_tests: string[];
  error_messages: string[];
  stack_traces: string[];
  likely_files: string[];
  root_cause_hypothesis: string;
  confidence: number;
  recommended_fix_strategy: string;
  needs_human_review: boolean;
}

export interface PatchFile {
  oldPath: string;
  newPath: string;
}

export interface SafetyCheckResult {
  passed: boolean;
  errors: string[];
  warnings: string[];
  changedFiles: string[];
  forbiddenFiles: string[];
}

export interface PatchResult {
  patch: string;
  changedFiles: string[];
  safety: SafetyCheckResult;
  dryRun: boolean;
  applied: boolean;
}

export interface TestResult {
  command: string;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  durationMs: number;
  passed: boolean;
  timedOut: boolean;
}

export interface ProviderConfig {
  provider: 'openai' | 'anthropic' | 'ollama';
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}

export interface PRMetadata {
  attempts: number;
  provider: string;
  model: string;
  dryRun: boolean;
  runUrl?: string;
  sha?: string;
}

export type AutoFixStatus = 'fixed' | 'dry-run' | 'failed' | 'unsafe' | 'needs-human-review';

export interface EvidenceReference {
  runId: string;
  path: string;
}

export interface AutoFixResult {
  status: AutoFixStatus;
  attempts: number;
  diagnosis: Diagnosis;
  patch?: string;
  changedFiles: string[];
  safety: SafetyCheckResult;
  testResult?: TestResult;
  prUrl?: string;
  prBody?: string;
  evidence?: EvidenceReference;
  reason?: string;
}

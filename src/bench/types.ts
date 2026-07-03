import type { AutoFixStatus, Diagnosis, SafetyCheckResult, TestResult } from '../core/types.js';

export type BenchmarkFormat = 'json' | 'markdown' | 'html';
export type BenchmarkCaseStatus = 'solved' | 'failed' | 'unsafe' | 'skipped';

export interface BenchmarkCase {
  id: string;
  language: string;
  category: string;
  difficulty: 'easy' | 'medium' | 'hard';
  fixture: string;
  failingCommand: string;
  testCommand: string;
  installCommand?: string;
  bugDescription: string;
  allowedFiles: string[];
  expectedChangedFiles: string[];
  successCondition: string;
  patch?: string;
  requiresNetwork?: boolean;
}

export interface BenchmarkSuite {
  name: string;
  version: string;
  rootPath: string;
  cases: BenchmarkCase[];
}

export interface BenchmarkRunOptions {
  suitePath: string;
  outputPath: string;
  provider: string;
  model?: string;
  maxRetries: number;
  concurrency: number;
  keepWorkdir?: boolean;
  format?: BenchmarkFormat;
  caseIds?: string[];
}

export interface BenchmarkCaseResult {
  caseId: string;
  language: string;
  category: string;
  difficulty: string;
  status: BenchmarkCaseStatus;
  attempts: number;
  runtimeMs: number;
  diagnosisSummary?: string;
  diagnosis?: Diagnosis;
  filesChanged: string[];
  linesChanged: number;
  testResult?: TestResult;
  safety?: SafetyCheckResult;
  failureReason?: string;
  patchDiffPath?: string;
  evidencePath?: string;
  workdir?: string;
  autoFixStatus?: AutoFixStatus;
}

export interface BenchmarkSummary {
  passAt1: number;
  passAt3: number;
  totalCases: number;
  solvedCases: number;
  failedCases: number;
  unsafePatchRejections: number;
  averageAttempts: number;
  medianRuntimeMs: number;
  medianFilesChanged: number;
  medianLinesChanged: number;
  tokenUsage?: number;
  estimatedCostUsd?: number;
  model: string;
  provider: string;
  devloopVersion: string;
  timestamp: string;
  machine: {
    platform: string;
    arch: string;
    node: string;
    cpuCount: number;
  };
}

export interface BenchmarkReport {
  suite: {
    name: string;
    version: string;
    path: string;
  };
  summary: BenchmarkSummary;
  cases: BenchmarkCaseResult[];
}

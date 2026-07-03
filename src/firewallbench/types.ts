import type { FirewallCategory, FirewallDecision, InputSource, RiskLevel } from '../firewall/types.js';

export type FirewallBenchFormat = 'json' | 'markdown' | 'html';
export type FirewallBenchCaseKind = 'input' | 'command' | 'patch';
export type FirewallBenchExpectedCategory = FirewallCategory | 'none';

export interface FirewallBenchCase {
  id: string;
  category: string;
  kind: FirewallBenchCaseKind;
  source?: InputSource;
  text?: string;
  command?: string;
  patch?: string;
  expectedDecision: FirewallDecision;
  expectedCategory: FirewallBenchExpectedCategory;
  expectedMinSeverity: RiskLevel;
  explanation: string;
}

export interface FirewallBenchSuite {
  name: string;
  version: string;
  rootPath: string;
  cases: FirewallBenchCase[];
}

export interface FirewallBenchCaseResult {
  id: string;
  category: string;
  kind: FirewallBenchCaseKind;
  expectedDecision: FirewallDecision;
  actualDecision: FirewallDecision;
  expectedCategory: FirewallBenchExpectedCategory;
  actualRiskLevel: RiskLevel;
  expectedMinSeverity: RiskLevel;
  matchedCategory: boolean;
  matchedSeverity: boolean;
  passed: boolean;
  explanation: string;
  failureReason?: string;
  findingIds?: string[];
}

export interface FirewallBenchCategorySummary {
  cases: number;
  passed: number;
  recall: number;
  falsePositiveRate: number;
}

export interface FirewallBenchSummary {
  totalCases: number;
  passedCases: number;
  failedCases: number;
  blockRate: number;
  falsePositiveRate: number;
  falseNegativeRate: number;
  precision: number;
  recall: number;
  f1: number;
  runtimeMs: number;
  byCategory: Record<string, FirewallBenchCategorySummary>;
  llmUsage?: {
    enabled: boolean;
    promptTokens: number;
    completionTokens: number;
    estimatedCostUsd: number;
  };
}

export interface FirewallBenchReport {
  suite: {
    name: string;
    version: string;
    path: string;
  };
  summary: FirewallBenchSummary;
  cases: FirewallBenchCaseResult[];
}

export interface FirewallBenchRunOptions {
  suitePath: string;
  outputPath: string;
  format?: FirewallBenchFormat;
  includeLlm?: boolean;
  category?: string;
}

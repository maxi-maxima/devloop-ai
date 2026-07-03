import type { FirewallResult } from '../firewall/types.js';
import type { TestResult } from '../core/types.js';

export type SupportedAgent = 'codex' | 'claude-code' | 'cursor-agent' | 'custom';
export type AgentRunStatus = 'dry-run' | 'completed' | 'blocked' | 'failed' | 'unsafe';
export type AgentSandboxMode = 'read-only' | 'workspace-write' | 'danger-full-access';

export interface AgentCommandSpec {
  executable: string;
  args: string[];
  cwd: string;
  display: string;
  shell?: boolean;
  env?: NodeJS.ProcessEnv;
}

export interface AgentAvailability {
  name: SupportedAgent;
  available: boolean;
  command?: string;
  reason?: string;
}

export interface AgentAdapterRunInput {
  repoPath: string;
  promptFile: string;
  prompt: string;
  command?: string;
  model?: string;
  outputFile?: string;
  sandbox: AgentSandboxMode;
  unsafe: boolean;
}

export interface AgentAdapter {
  name: SupportedAgent;
  description: string;
  defaultCommand?: string;
  buildCommand(input: AgentAdapterRunInput): Promise<AgentCommandSpec>;
  checkAvailability(command?: string): Promise<AgentAvailability>;
}

export interface AgentRunInput {
  repoPath: string;
  agent: SupportedAgent;
  prompt: string;
  command?: string;
  model?: string;
  outputFile?: string;
  sandbox?: AgentSandboxMode;
  dryRun?: boolean;
  allowWrite?: boolean;
  allowNetwork?: boolean;
  unsafe?: boolean;
  testCommand?: string;
  timeoutMs?: number;
}

export interface AgentRunResult {
  status: AgentRunStatus;
  adapter: SupportedAgent;
  dryRun: boolean;
  applied: boolean;
  command?: string;
  exitCode?: number | null;
  stdout: string;
  stderr: string;
  patch?: string;
  patchReview?: FirewallResult;
  testResult?: TestResult;
  evidence?: {
    runId: string;
    path: string;
  };
  prUrl?: string;
  firewall: {
    input: FirewallResult;
    command?: FirewallResult;
    patch?: FirewallResult;
  };
  reason?: string;
}

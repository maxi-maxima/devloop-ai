export type TrustLevel = 'trusted' | 'semi_trusted' | 'untrusted';

export type InputSource =
  | 'issue_body'
  | 'issue_comment'
  | 'pull_request_title'
  | 'pull_request_body'
  | 'pull_request_comment'
  | 'commit_message'
  | 'branch_name'
  | 'ci_log'
  | 'test_output'
  | 'repository_file'
  | 'user_prompt'
  | 'system_config';

export type FirewallDecision = 'allow' | 'block' | 'redact' | 'require_human_approval';

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export type FirewallCategory =
  | 'prompt_injection'
  | 'secret_exposure'
  | 'dangerous_command'
  | 'unsafe_patch'
  | 'supply_chain_risk'
  | 'policy_violation';

export interface FirewallFinding {
  id: string;
  category: FirewallCategory;
  severity: RiskLevel;
  source: InputSource;
  message: string;
  evidence: string;
  recommendation: string;
}

export interface FirewallResult {
  decision: FirewallDecision;
  riskLevel: RiskLevel;
  score: number;
  findings: FirewallFinding[];
  sanitizedText?: string;
}

export interface RedactionResult {
  redactedText: string;
  findings: FirewallFinding[];
  replacements: {
    label: string;
    count: number;
  }[];
}

export interface FirewallRule {
  id: string;
  category: FirewallCategory;
  severity: RiskLevel;
  pattern: RegExp;
  message: string;
  recommendation: string;
}

export interface CommandRule {
  id: string;
  category?: FirewallCategory;
  severity: RiskLevel;
  pattern: RegExp;
  message: string;
  recommendation: string;
  decision?: FirewallDecision;
}

export interface FirewallPolicy {
  mode: 'strict' | 'default' | 'permissive';
  requireHumanApproval: FirewallCategory[];
  block: FirewallCategory[];
  allowedCommands: string[];
  deniedCommands: string[];
  maxPatchFiles: number;
  allowNetwork: boolean;
  allowWorkflowPermissionChanges: boolean;
}

export interface TaintedInput {
  source: InputSource;
  content: string;
  trustLevel?: TrustLevel;
}

export interface SafeAgentContext {
  trustedInstructions: string;
  untrustedData: {
    source: InputSource;
    content: string;
    warning: string;
  }[];
}

export interface CheckInputOptions {
  source: InputSource;
  text: string;
  policy?: FirewallPolicy;
}

export interface CheckPatchInput {
  repoPath: string;
  patch: string;
}

export interface RepositoryScanOptions {
  maxBytesPerFile?: number;
}

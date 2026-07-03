export type OrgDefaultMode = 'dry-run' | 'pr';
export type OrgFirewallMode = 'strict' | 'default' | 'permissive';

export interface DevLoopOrgConfig {
  organization: string;
  defaults: {
    mode: OrgDefaultMode;
    maxRetries: number;
    allowNetwork: boolean;
    firewallMode: OrgFirewallMode;
  };
  repositories: {
    include: string[];
    exclude: string[];
  };
}

export interface OrgRepository {
  name: string;
  fullName: string;
  defaultBranch: string;
  archived: boolean;
  private: boolean;
}

export interface OrgJobSummary {
  status: 'succeeded' | 'failed' | 'blocked' | 'unsafe' | 'dry-run';
  type: 'ci-autofix' | 'security-autofix' | 'firewall' | string;
}

export interface OrgRepositoryScan {
  repo: string;
  fullName: string;
  defaultBranch: string;
  language: string;
  ci: boolean;
  workflows: string[];
  testCommand: string;
  securityScanners: string[];
  devloopConfig: boolean;
  firewallPolicy: boolean;
  mode: OrgDefaultMode | 'not-configured';
  recentJobs: OrgJobSummary[];
  lastStatus: string;
}

export interface OrgScanSummary {
  totalRepos: number;
  reposEnabled: number;
  reposDryRun: number;
  reposPrMode: number;
  recentJobs: number;
  successRate: number;
  blockedFirewallEvents: number;
  securityAutofixCount: number;
}

export interface OrgScanReport {
  organization: string;
  generatedAt: string;
  repositories: OrgRepositoryScan[];
  summary: OrgScanSummary;
}

export interface RolloutPlan {
  organization: string;
  dryRun: boolean;
  repositories: RolloutRepositoryPlan[];
}

export interface RolloutRepositoryPlan {
  repo: string;
  action: 'create-pr' | 'skip';
  title: string;
  branch: string;
  base: string;
  files: Record<string, string>;
  warnings: string[];
  reason?: string;
  prUrl?: string;
}

export interface PolicySyncPlan {
  organization: string;
  dryRun: boolean;
  repositories: PolicySyncRepositoryPlan[];
}

export interface PolicySyncRepositoryPlan {
  repo: string;
  changed: boolean;
  path: string;
  current?: string;
  desired: string;
  diff: string;
  action: 'create-pr' | 'skip';
  prUrl?: string;
}

import type { OrgGitHubClient } from './org-client.js';
import { discoverOrgRepositories } from './repo-discovery.js';
import type { DevLoopOrgConfig, OrgRepositoryScan, OrgScanReport, OrgScanSummary } from './types.js';

export interface ScanOrganizationInput {
  client: OrgGitHubClient;
  config: DevLoopOrgConfig;
}

export async function scanOrganization(input: ScanOrganizationInput): Promise<OrgScanReport> {
  const repos = await discoverOrgRepositories(input.client, input.config);
  const repositories = await Promise.all(
    repos.map((repo) => scanRepository(input.client, repo.name, repo.fullName, repo.defaultBranch))
  );
  return {
    organization: input.config.organization,
    generatedAt: new Date().toISOString(),
    repositories,
    summary: summarize(repositories)
  };
}

async function scanRepository(
  client: OrgGitHubClient,
  repo: string,
  fullName: string,
  defaultBranch: string
): Promise<OrgRepositoryScan> {
  const files = await client.listRepositoryFiles(repo);
  const packageJson = await client.getFile(repo, 'package.json');
  const pyproject = await client.getFile(repo, 'pyproject.toml');
  const devloopConfigContent = await client.getFile(repo, '.devloop.yml');
  const firewallPolicyContent = await client.getFile(repo, '.devloop-policy.yml');
  const recentJobs = await client.listRecentDevLoopJobs(repo);
  const workflows = files.filter((file) => file.startsWith('.github/workflows/') && /\.ya?ml$/.test(file));
  return {
    repo,
    fullName,
    defaultBranch,
    language: detectLanguage(files, packageJson, pyproject),
    ci: workflows.length > 0,
    workflows,
    testCommand: detectTestCommand(packageJson, pyproject, files, workflows),
    securityScanners: detectSecurityScanners(files, workflows),
    devloopConfig: devloopConfigContent !== undefined,
    firewallPolicy: firewallPolicyContent !== undefined,
    mode: detectDevLoopMode(devloopConfigContent),
    recentJobs,
    lastStatus: recentJobs[0]?.status ?? 'unknown'
  };
}

function summarize(repositories: OrgRepositoryScan[]): OrgScanSummary {
  const jobs = repositories.flatMap((repo) => repo.recentJobs);
  const success = jobs.filter((job) => job.status === 'succeeded').length;
  return {
    totalRepos: repositories.length,
    reposEnabled: repositories.filter((repo) => repo.devloopConfig).length,
    reposDryRun: repositories.filter((repo) => repo.mode === 'dry-run').length,
    reposPrMode: repositories.filter((repo) => repo.mode === 'pr').length,
    recentJobs: jobs.length,
    successRate: jobs.length === 0 ? 0 : round(success / jobs.length),
    blockedFirewallEvents: jobs.filter((job) => job.status === 'blocked' || job.type === 'firewall').length,
    securityAutofixCount: jobs.filter((job) => job.type === 'security-autofix').length
  };
}

function detectLanguage(files: string[], packageJson?: string, pyproject?: string): string {
  if (packageJson) {
    if (/typescript|ts-node|tsx/i.test(packageJson) || files.some((file) => file.endsWith('.ts'))) {
      return 'TypeScript';
    }
    return 'JavaScript';
  }
  if (pyproject || files.some((file) => file.endsWith('.py'))) {
    return 'Python';
  }
  if (files.some((file) => file.endsWith('.go'))) {
    return 'Go';
  }
  if (files.some((file) => file.endsWith('.rs'))) {
    return 'Rust';
  }
  return 'Unknown';
}

function detectTestCommand(packageJson?: string, pyproject?: string, files: string[] = [], workflows: string[] = []): string {
  if (packageJson) {
    const parsed = JSON.parse(packageJson) as { scripts?: Record<string, string> };
    if (parsed.scripts?.test) {
      return parsed.scripts.test;
    }
  }
  if (pyproject || files.some((file) => /^tests?\//.test(file) && file.endsWith('.py'))) {
    return 'pytest';
  }
  if (workflows.length > 0) {
    return 'see workflow';
  }
  return 'unknown';
}

function detectSecurityScanners(files: string[], workflows: string[]): string[] {
  const joined = [...files, ...workflows].join('\n').toLowerCase();
  const scanners: string[] = [];
  if (joined.includes('codeql')) scanners.push('CodeQL');
  if (joined.includes('semgrep')) scanners.push('Semgrep');
  if (joined.includes('eslint')) scanners.push('ESLint');
  if (joined.includes('bandit')) scanners.push('Bandit');
  return scanners;
}

function detectDevLoopMode(content?: string): OrgRepositoryScan['mode'] {
  if (!content) {
    return 'not-configured';
  }
  return /mode\s*:\s*pr\b/.test(content) ? 'pr' : 'dry-run';
}

function round(value: number): number {
  return Number(value.toFixed(4));
}

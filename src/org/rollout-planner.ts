import type { DevLoopOrgConfig, OrgScanReport, RolloutPlan, RolloutRepositoryPlan } from './types.js';

export interface RolloutOptions {
  confirmPrMode?: boolean;
  includeGitHubAction?: boolean;
  dryRun?: boolean;
}

export function createRolloutPlan(
  scan: OrgScanReport,
  config: DevLoopOrgConfig,
  options: RolloutOptions = {}
): RolloutPlan {
  return {
    organization: scan.organization,
    dryRun: options.dryRun ?? true,
    repositories: scan.repositories.map((repo): RolloutRepositoryPlan => {
      const hasDevLoopAction = repo.workflows.some((workflow) => /devloop/i.test(workflow));
      if (repo.devloopConfig && repo.firewallPolicy && (!options.includeGitHubAction || hasDevLoopAction)) {
        return {
          repo: repo.repo,
          action: 'skip',
          title: '',
          branch: '',
          base: 'main',
          files: {},
          warnings: [],
          reason: 'Repository already has DevLoop configuration.'
        };
      }

      const warnings: string[] = [];
      const requestedMode = config.defaults.mode;
      const mode = requestedMode === 'pr' && !options.confirmPrMode ? 'dry-run' : requestedMode;
      if (requestedMode === 'pr' && !options.confirmPrMode) {
        warnings.push('PR mode was not enabled because --confirm-pr-mode was not passed.');
      }

      const files: Record<string, string> = {};
      if (!repo.devloopConfig) {
        files['.devloop.yml'] = renderDevLoopConfig({ ...config, defaults: { ...config.defaults, mode } }, repo.testCommand);
      }
      if (!repo.firewallPolicy) {
        files['.devloop-policy.yml'] = renderFirewallPolicy(config);
      }
      if (options.includeGitHubAction && !hasDevLoopAction) {
        files['.github/workflows/devloop-autofix.yml'] = renderGitHubAction(repo.testCommand);
      }

      return {
        repo: repo.repo,
        action: Object.keys(files).length > 0 ? 'create-pr' : 'skip',
        title: 'chore: enable DevLoop AI',
        branch: 'devloop/org-rollout',
        base: repo.defaultBranch,
        files,
        warnings,
        reason: Object.keys(files).length > 0 ? undefined : 'No rollout changes needed.'
      };
    })
  };
}

export function renderDevLoopConfig(config: DevLoopOrgConfig, testCommand: string): string {
  return [
    'autofix:',
    '  enabled: true',
    `  mode: ${config.defaults.mode}`,
    `  maxRetries: ${config.defaults.maxRetries}`,
    `  testCommand: "${testCommand === 'unknown' ? 'npm test' : testCommand}"`,
    `  allowNetwork: ${config.defaults.allowNetwork}`,
    'security:',
    '  enabled: true',
    ''
  ].join('\n');
}

export function renderFirewallPolicy(config: DevLoopOrgConfig): string {
  return [
    'firewall:',
    `  mode: ${config.defaults.firewallMode}`,
    `  allowNetwork: ${config.defaults.allowNetwork}`,
    '  block:',
    '    - secret_exposure',
    '    - prompt_injection',
    ''
  ].join('\n');
}

function renderGitHubAction(testCommand: string): string {
  return [
    'name: DevLoop Autofix',
    'on:',
    '  workflow_run:',
    '    workflows: ["CI"]',
    '    types: [completed]',
    'jobs:',
    '  devloop:',
    '    runs-on: ubuntu-latest',
    '    steps:',
    '      - uses: actions/checkout@v4',
    '      - run: npm install -g devloop-ai',
    `      - run: devloop autofix --log-file ci.log --test-command "${testCommand === 'unknown' ? 'npm test' : testCommand}" --dry-run`,
    ''
  ].join('\n');
}

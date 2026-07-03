import { renderFirewallPolicy } from './rollout-planner.js';
import type { DevLoopOrgConfig, OrgScanReport, PolicySyncPlan } from './types.js';

export interface PolicySyncOptions {
  firewallMode: DevLoopOrgConfig['defaults']['firewallMode'];
  allowNetwork: boolean;
  dryRun?: boolean;
}

export function createPolicySyncPlan(scan: OrgScanReport, options: PolicySyncOptions): PolicySyncPlan {
  const config: DevLoopOrgConfig = {
    organization: scan.organization,
    defaults: {
      mode: 'dry-run',
      maxRetries: 2,
      allowNetwork: options.allowNetwork,
      firewallMode: options.firewallMode
    },
    repositories: {
      include: ['*'],
      exclude: []
    }
  };
  const desired = renderFirewallPolicy(config);
  return {
    organization: scan.organization,
    dryRun: options.dryRun ?? true,
    repositories: scan.repositories.map((repo) => {
      const current = repo.firewallPolicy ? 'existing policy not fetched in scan summary' : undefined;
      const changed = !repo.firewallPolicy || current !== desired;
      return {
        repo: repo.repo,
        changed,
        path: '.devloop-policy.yml',
        current,
        desired,
        diff: changed ? renderDiff('.devloop-policy.yml', current, desired) : '',
        action: changed ? 'create-pr' : 'skip'
      };
    })
  };
}

function renderDiff(filePath: string, current: string | undefined, desired: string): string {
  return [
    `--- a/${filePath}`,
    `+++ b/${filePath}`,
    '@@',
    ...(current ? current.trimEnd().split('\n').map((line) => `-${line}`) : []),
    ...desired.trimEnd().split('\n').map((line) => `+${line}`),
    ''
  ].join('\n');
}

import { writeFile } from 'node:fs/promises';
import type { OrgScanReport } from './types.js';

export function renderOrgReport(report: OrgScanReport): string {
  const rows = report.repositories
    .map((repo) =>
      [
        repo.repo,
        repo.language,
        repo.ci ? repo.workflows.join(', ') || 'yes' : 'no',
        repo.testCommand,
        repo.devloopConfig ? repo.mode : 'missing',
        repo.firewallPolicy ? 'present' : 'missing',
        repo.lastStatus
      ].join(' | ')
    )
    .map((row) => `| ${row} |`)
    .join('\n');

  return [
    '# DevLoop Organization Report',
    '',
    `Organization: ${report.organization}`,
    `Generated: ${report.generatedAt}`,
    '',
    '## Summary',
    '',
    `- Repositories: ${report.summary.totalRepos}`,
    `- Enabled: ${report.summary.reposEnabled}`,
    `- Dry-run mode: ${report.summary.reposDryRun}`,
    `- PR mode: ${report.summary.reposPrMode}`,
    `- Recent jobs: ${report.summary.recentJobs}`,
    `- Success rate: ${(report.summary.successRate * 100).toFixed(1)}%`,
    `- Blocked firewall events: ${report.summary.blockedFirewallEvents}`,
    `- Security autofix count: ${report.summary.securityAutofixCount}`,
    '',
    '| Repo | Language | CI | Test Command | DevLoop Config | Firewall | Last Status |',
    '|---|---|---|---|---|---|---|',
    rows || '| - | - | - | - | - | - | - |',
    ''
  ].join('\n');
}

export async function writeOrgReport(report: OrgScanReport, outputPath = 'devloop-org-report.md'): Promise<string> {
  await writeFile(outputPath, renderOrgReport(report), 'utf8');
  return outputPath;
}

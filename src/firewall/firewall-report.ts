import type { FirewallResult } from './types.js';

export function formatFirewallReport(result: FirewallResult): string {
  const lines = [
    '# DevLoop Agent Firewall Report',
    '',
    `Decision: ${result.decision}`,
    `Risk: ${result.riskLevel}`,
    `Score: ${result.score}`,
    '',
    '## Findings'
  ];

  if (result.findings.length === 0) {
    lines.push('', 'No firewall findings.');
    return lines.join('\n');
  }

  for (const finding of result.findings) {
    lines.push(
      '',
      `### ${finding.id}`,
      '',
      `- Category: ${finding.category}`,
      `- Severity: ${finding.severity}`,
      `- Source: ${finding.source}`,
      `- Message: ${finding.message}`,
      `- Evidence: ${finding.evidence}`,
      `- Recommendation: ${finding.recommendation}`
    );
  }

  return lines.join('\n');
}

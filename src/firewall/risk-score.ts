import type { FirewallDecision, FirewallFinding, FirewallPolicy, FirewallResult, RiskLevel } from './types.js';

const riskWeights: Record<RiskLevel, number> = {
  low: 10,
  medium: 35,
  high: 70,
  critical: 95
};

const riskOrder: RiskLevel[] = ['low', 'medium', 'high', 'critical'];

export function scoreForSeverity(level: RiskLevel): number {
  return riskWeights[level];
}

export function maxRiskLevel(findings: FirewallFinding[]): RiskLevel {
  return findings.reduce<RiskLevel>((highest, finding) => {
    return riskOrder.indexOf(finding.severity) > riskOrder.indexOf(highest) ? finding.severity : highest;
  }, 'low');
}

export function scoreFindings(findings: FirewallFinding[]): number {
  if (findings.length === 0) {
    return 0;
  }

  const total = findings.reduce((sum, finding) => sum + scoreForSeverity(finding.severity), 0);
  return Math.min(100, Math.round(total / Math.max(1, Math.sqrt(findings.length))));
}

export function decisionForFindings(findings: FirewallFinding[], policy: FirewallPolicy): FirewallDecision {
  if (findings.length === 0) {
    return 'allow';
  }

  if (findings.some((finding) => policy.block.includes(finding.category))) {
    return 'block';
  }

  if (findings.some((finding) => finding.severity === 'critical')) {
    return 'block';
  }

  if (findings.some((finding) => policy.requireHumanApproval.includes(finding.category))) {
    return 'require_human_approval';
  }

  if (findings.some((finding) => finding.severity === 'high')) {
    return 'require_human_approval';
  }

  return findings.some((finding) => finding.category === 'secret_exposure') ? 'redact' : 'allow';
}

export function resultFromFindings(
  findings: FirewallFinding[],
  policy: FirewallPolicy,
  sanitizedText?: string
): FirewallResult {
  return {
    decision: decisionForFindings(findings, policy),
    riskLevel: maxRiskLevel(findings),
    score: scoreFindings(findings),
    findings,
    sanitizedText
  };
}

export function mergeFirewallResults(results: FirewallResult[], policy: FirewallPolicy): FirewallResult {
  const findings = results.flatMap((result) => result.findings);
  return resultFromFindings(findings, policy);
}

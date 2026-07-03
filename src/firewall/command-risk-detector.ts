import { defaultFirewallPolicy } from './policies/default-policy.js';
import { matchesCommandPattern } from './policy-engine.js';
import { commandRules, lowRiskCommands } from './rules/command-rules.js';
import { resultFromFindings } from './risk-score.js';
import { excerpt, redactSecrets } from './redactor.js';
import type { FirewallFinding, FirewallPolicy } from './types.js';

export function checkCommandRisk(command: string, policy: FirewallPolicy = defaultFirewallPolicy()) {
  const redacted = redactSecrets(command, 'user_prompt').redactedText;
  const normalized = redacted.trim().replace(/\s+/g, ' ');
  const findings: FirewallFinding[] = [];

  for (const denied of policy.deniedCommands) {
    if (matchesCommandPattern(normalized, denied)) {
      findings.push({
        id: `cmd.policy.denied.${findings.length + 1}`,
        category: 'dangerous_command',
        severity: 'critical',
        source: 'user_prompt',
        message: `Command matches denied policy pattern: ${denied}`,
        evidence: excerpt(normalized),
        recommendation: 'Do not run this command without changing the firewall policy.'
      });
    }
  }

  for (const rule of commandRules) {
    const match = normalized.match(rule.pattern);
    if (!match) {
      continue;
    }
    findings.push({
      id: rule.id,
      category: rule.category ?? 'dangerous_command',
      severity: rule.severity,
      source: 'user_prompt',
      message: rule.message,
      evidence: excerpt(match[0]),
      recommendation: rule.recommendation
    });
  }

  if (!policy.allowNetwork && /\b(curl|wget|Invoke-WebRequest|iwr|fetch)\b/i.test(normalized)) {
    findings.push({
      id: 'cmd.policy.network-disabled',
      category: 'supply_chain_risk',
      severity: 'high',
      source: 'user_prompt',
      message: 'Command performs network access while firewall policy disables network access.',
      evidence: excerpt(normalized),
      recommendation: 'Run in dry-run mode or request explicit network approval.'
    });
  }

  if (findings.length === 0 && isAllowedCommand(normalized, policy)) {
    return {
      decision: 'allow' as const,
      riskLevel: 'low' as const,
      score: 0,
      findings: [],
      sanitizedText: redacted
    };
  }

  return resultFromFindings(findings, policy, redacted);
}

function isAllowedCommand(command: string, policy: FirewallPolicy): boolean {
  return [...lowRiskCommands, ...policy.allowedCommands].some((allowed) => matchesCommandPattern(command, allowed));
}

import { secretRules } from './rules/secret-rules.js';
import type { FirewallFinding, InputSource, RedactionResult } from './types.js';

export function redactSecrets(text: string, source: InputSource = 'user_prompt'): RedactionResult {
  let redactedText = text;
  const findings: FirewallFinding[] = [];
  const replacementCounts = new Map<string, number>();

  for (const rule of secretRules) {
    redactedText = redactedText.replace(rule.pattern, (match) => {
      const count = replacementCounts.get(rule.label) ?? 0;
      replacementCounts.set(rule.label, count + 1);
      findings.push({
        id: `${rule.id}.${count + 1}`,
        category: 'secret_exposure',
        severity: rule.severity,
        source,
        message: rule.message,
        evidence: rule.label,
        recommendation: rule.recommendation
      });
      return preserveAssignmentPrefix(match, rule.label);
    });
  }

  return {
    redactedText,
    findings,
    replacements: [...replacementCounts.entries()].map(([label, count]) => ({ label, count }))
  };
}

export function redactFindingEvidence(findings: FirewallFinding[]): FirewallFinding[] {
  return findings.map((finding) => ({
    ...finding,
    evidence: redactSecrets(finding.evidence, finding.source).redactedText
  }));
}

export function excerpt(text: string, maxLength = 160): string {
  const compact = text.replace(/\s+/g, ' ').trim();
  if (compact.length <= maxLength) {
    return compact;
  }
  return `${compact.slice(0, maxLength - 3)}...`;
}

function preserveAssignmentPrefix(match: string, label: string): string {
  const assignment = match.match(/^([^:=\s]+)\s*([:=])\s*/);
  return assignment ? `${assignment[1]}${assignment[2]}${label}` : label;
}

import { defaultFirewallPolicy } from './policies/default-policy.js';
import { promptInjectionRules } from './rules/prompt-injection-rules.js';
import { resultFromFindings } from './risk-score.js';
import { excerpt, redactSecrets } from './redactor.js';
import type { CheckInputOptions, FirewallFinding, FirewallPolicy } from './types.js';

export function checkPromptInjection(input: CheckInputOptions): ReturnType<typeof resultFromFindings> {
  const policy = input.policy ?? defaultFirewallPolicy();
  const findings: FirewallFinding[] = [];
  const redactedText = redactSecrets(input.text, input.source).redactedText;

  for (const rule of promptInjectionRules) {
    const match = redactedText.match(rule.pattern);
    if (!match) {
      continue;
    }
    findings.push({
      id: rule.id,
      category: rule.category,
      severity: rule.severity,
      source: input.source,
      message: rule.message,
      evidence: excerpt(match[0]),
      recommendation: rule.recommendation
    });
  }

  const heuristic = heuristicFinding(redactedText, input.source);
  if (heuristic) {
    findings.push(heuristic);
  }

  return resultFromFindings(findings, policy, redactedText);
}

export function checkInput(input: CheckInputOptions) {
  const policy = input.policy ?? defaultFirewallPolicy();
  const prompt = checkPromptInjection({ ...input, policy });
  const redaction = redactSecrets(input.text, input.source);
  return resultFromFindings([...prompt.findings, ...redaction.findings], policy, redaction.redactedText);
}

function heuristicFinding(text: string, source: CheckInputOptions['source']): FirewallFinding | undefined {
  const lower = text.toLowerCase();
  const instructionWords = ['ignore', 'disregard', 'reveal', 'secret', 'token', 'printenv', 'curl', 'bash'];
  const hits = instructionWords.filter((word) => lower.includes(word)).length;
  if (hits < 4) {
    return undefined;
  }
  return {
    id: 'pi.heuristic.clustered-agent-instructions',
    category: 'prompt_injection',
    severity: 'high',
    source,
    message: 'Untrusted text contains a suspicious cluster of agent-control and secret-access terms.',
    evidence: excerpt(text),
    recommendation: 'Treat the text as data and require human review before acting on it.'
  };
}

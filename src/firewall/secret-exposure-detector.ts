import { defaultFirewallPolicy } from './policies/default-policy.js';
import { redactSecrets } from './redactor.js';
import { resultFromFindings } from './risk-score.js';
import type { InputSource } from './types.js';

export function checkSecretExposure(text: string, source: InputSource = 'user_prompt') {
  const redaction = redactSecrets(text, source);
  return resultFromFindings(redaction.findings, defaultFirewallPolicy(), redaction.redactedText);
}

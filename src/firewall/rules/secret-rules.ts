import type { FirewallRule } from '../types.js';

export interface SecretRule extends FirewallRule {
  label: string;
}

export const secretRules: SecretRule[] = [
  {
    id: 'secret.github-token',
    category: 'secret_exposure',
    severity: 'critical',
    label: '[REDACTED_GITHUB_TOKEN]',
    pattern: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{20,}\b|\bgithub_pat_[A-Za-z0-9_]{30,}\b/g,
    message: 'GitHub token detected.',
    recommendation: 'Redact the token and rotate it if it was exposed.'
  },
  {
    id: 'secret.openai-key',
    category: 'secret_exposure',
    severity: 'critical',
    label: '[REDACTED_OPENAI_KEY]',
    pattern: /\bsk-(?:proj-)?[A-Za-z0-9_-]{24,}\b/g,
    message: 'OpenAI API key detected.',
    recommendation: 'Redact the key and rotate it if it was exposed.'
  },
  {
    id: 'secret.anthropic-key',
    category: 'secret_exposure',
    severity: 'critical',
    label: '[REDACTED_ANTHROPIC_KEY]',
    pattern: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/g,
    message: 'Anthropic API key detected.',
    recommendation: 'Redact the key and rotate it if it was exposed.'
  },
  {
    id: 'secret.aws-access-key',
    category: 'secret_exposure',
    severity: 'critical',
    label: '[REDACTED_AWS_ACCESS_KEY]',
    pattern: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g,
    message: 'AWS access key id detected.',
    recommendation: 'Redact the key and rotate associated credentials if needed.'
  },
  {
    id: 'secret.google-api-key',
    category: 'secret_exposure',
    severity: 'high',
    label: '[REDACTED_GOOGLE_API_KEY]',
    pattern: /\bAIza[0-9A-Za-z_-]{35}\b/g,
    message: 'Google API key detected.',
    recommendation: 'Redact the key and review its restrictions.'
  },
  {
    id: 'secret.slack-token',
    category: 'secret_exposure',
    severity: 'critical',
    label: '[REDACTED_SLACK_TOKEN]',
    pattern: /\bxox[baprs]-[0-9A-Za-z-]{20,}\b/g,
    message: 'Slack token detected.',
    recommendation: 'Redact and rotate the token.'
  },
  {
    id: 'secret.stripe-key',
    category: 'secret_exposure',
    severity: 'critical',
    label: '[REDACTED_STRIPE_KEY]',
    pattern: /\b(?:sk|rk)_live_[0-9A-Za-z]{20,}\b/g,
    message: 'Stripe live key detected.',
    recommendation: 'Redact and rotate the key.'
  },
  {
    id: 'secret.private-key',
    category: 'secret_exposure',
    severity: 'critical',
    label: '[REDACTED_PRIVATE_KEY]',
    pattern: /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z0-9 ]*PRIVATE KEY-----/g,
    message: 'Private key block detected.',
    recommendation: 'Never pass private keys into prompts, logs, or PR bodies.'
  },
  {
    id: 'secret.generic-high-entropy',
    category: 'secret_exposure',
    severity: 'high',
    label: '[REDACTED_SECRET]',
    pattern: /\b(?:secret|token|password|api[_-]?key|session[_-]?secret)\s*[:=]\s*["']?[A-Za-z0-9_./+=-]{32,}["']?/gi,
    message: 'Potential high-entropy secret detected.',
    recommendation: 'Redact the value and verify whether it is a real credential.'
  }
];

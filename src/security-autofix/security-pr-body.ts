import { TestResult } from '../core/types.js';
import { SecurityDiagnosis } from './security-diagnoser.js';
import { SecurityAlert } from './sarif-parser.js';

export interface SecurityPrBodyInput {
  alert: SecurityAlert;
  diagnosis: SecurityDiagnosis;
  changedFiles: string[];
  testsRun: string[];
  validation: string | TestResult;
  metadata: {
    provider: string;
    model: string;
    attempts: number;
    sandbox: string;
  };
}

export function buildSecurityPrBody(input: SecurityPrBodyInput): string {
  const primaryFile = input.alert.locations[0]?.uri ?? '(unknown)';
  const validation =
    typeof input.validation === 'string'
      ? input.validation
      : `${input.validation.command}: ${input.validation.passed ? 'passed' : 'failed'}`;

  return [
    '## Security Alert',
    `- rule id: ${input.alert.ruleId}`,
    `- severity: ${input.alert.severity}`,
    `- affected file: ${primaryFile}`,
    `- scanner: ${input.alert.scanner}`,
    '',
    '## Root Cause',
    input.diagnosis.root_cause,
    '',
    '## Fix',
    input.diagnosis.safe_fix_strategy,
    '',
    'Changed files:',
    ...input.changedFiles.map((file) => `- ${file}`),
    '',
    '## Validation',
    ...input.testsRun.map((command) => `- ${command}`),
    validation,
    '',
    '## Safety Notes',
    'This is AI-generated and requires human review before merge. DevLoop did not intentionally suppress scanner rules, weaken validation, disable authentication, or edit secret files.',
    '',
    '## DevLoop Metadata',
    `- provider: ${input.metadata.provider}`,
    `- model: ${input.metadata.model}`,
    `- attempt count: ${input.metadata.attempts}`,
    `- sandbox runner: ${input.metadata.sandbox}`
  ].join('\n');
}

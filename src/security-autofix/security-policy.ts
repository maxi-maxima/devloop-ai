import { validatePatchSafety } from '../core/guardrails.js';

export interface SecurityPatchReview {
  approved: boolean;
  risk_level: 'low' | 'medium' | 'high';
  issues: string[];
  reason: string;
}

const FORBIDDEN_PATTERNS: Array<[RegExp, string]> = [
  [/(eslint|semgrep|codeql|bandit|snyk|trivy)-disable|nosec|noqa|pragma:\s*allowlist/i, 'Patch appears to silence a scanner rule.'],
  [/disable\s+(auth|authentication|authorization)/i, 'Patch appears to disable authentication or authorization.'],
  [/validate\w*\s*=\s*false|skipValidation|allowAll/i, 'Patch appears to weaken validation.'],
  [/console\.log\([^)]*(secret|token|password|api[_-]?key)/i, 'Patch appears to log sensitive data.'],
  [/(password|api[_-]?key|token|secret)\s*=\s*['"][^'"]+['"]/i, 'Patch appears to hardcode credentials or secrets.'],
  [/^-.*(assert|expect|test|it)\(/im, 'Patch appears to delete tests.']
];

export function reviewSecurityPatchPolicy(patch: string): SecurityPatchReview {
  const safety = validatePatchSafety(patch);
  const issues = [...safety.errors];
  const addedLines = patch
    .split(/\r?\n/)
    .filter((line) => line.startsWith('+') && !line.startsWith('+++'))
    .join('\n');
  const removedLines = patch
    .split(/\r?\n/)
    .filter((line) => line.startsWith('-') && !line.startsWith('---'))
    .join('\n');
  for (const [pattern, message] of FORBIDDEN_PATTERNS) {
    const target = message.includes('delete tests') ? removedLines : addedLines;
    if (pattern.test(target)) {
      issues.push(message);
    }
  }

  return {
    approved: issues.length === 0,
    risk_level: issues.length === 0 ? 'low' : 'high',
    issues,
    reason: issues.length === 0 ? 'Patch passed security autofix policy checks.' : issues.join('\n')
  };
}

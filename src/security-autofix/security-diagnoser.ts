import { SecurityAlert } from './sarif-parser.js';

export interface SecurityDiagnosis {
  summary: string;
  rule_id: string;
  severity: string;
  cwe?: string;
  affected_files: string[];
  dataflow_summary: string;
  root_cause: string;
  safe_fix_strategy: string;
  confidence: number;
  needs_human_review: boolean;
}

export function diagnoseSecurityAlert(alert: SecurityAlert): SecurityDiagnosis {
  const affectedFiles = [...new Set(alert.locations.map((location) => location.uri))];
  return {
    summary: alert.message || `Security alert ${alert.ruleId}`,
    rule_id: alert.ruleId,
    severity: alert.severity,
    cwe: alert.cwe,
    affected_files: affectedFiles,
    dataflow_summary: alert.codeFlows
      .flatMap((flow) => flow.locations.map((location) => `${location.uri}:${location.startLine ?? '?'}`))
      .join(' -> '),
    root_cause: rootCauseForRule(alert.ruleId),
    safe_fix_strategy: safeFixForRule(alert.ruleId),
    confidence: 0.72,
    needs_human_review: true
  };
}

function rootCauseForRule(ruleId: string): string {
  if (ruleId.includes('xss')) {
    return 'Untrusted text reaches HTML output without output encoding.';
  }
  if (ruleId.includes('path-traversal')) {
    return 'User-controlled paths are resolved without enforcing containment under the intended root.';
  }
  if (ruleId.includes('hardcoded-secret')) {
    return 'Secret-like configuration is stored in source instead of being read from runtime configuration.';
  }
  if (ruleId.includes('sql')) {
    return 'User input is interpolated into a SQL string instead of being passed as a query parameter.';
  }
  if (ruleId.includes('json')) {
    return 'Untrusted JSON is cast to a trusted type without validating the parsed shape.';
  }
  return 'The static analysis alert identifies a security boundary that needs a minimal root-cause fix.';
}

function safeFixForRule(ruleId: string): string {
  if (ruleId.includes('xss')) {
    return 'Escape HTML special characters before rendering user-controlled text.';
  }
  if (ruleId.includes('path-traversal')) {
    return 'Resolve and normalize paths, then reject paths outside the allowed root.';
  }
  if (ruleId.includes('hardcoded-secret')) {
    return 'Remove the hardcoded placeholder and read the value from environment configuration.';
  }
  if (ruleId.includes('sql')) {
    return 'Use a parameterized query and pass user-controlled values separately from SQL text.';
  }
  if (ruleId.includes('json')) {
    return 'Validate parsed JSON shape before returning it as trusted data.';
  }
  return 'Return DEVLOOP_CANNOT_FIX_SAFELY unless a narrow root-cause patch is clear.';
}

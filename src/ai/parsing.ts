export interface AnalysisResult {
  architectureSummary: string;
  bugs: Array<{
    title: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    file: string;
    evidence: string;
  }>;
  riskyFiles: Array<{ file: string; reason: string }>;
  recommendedFix: {
    title: string;
    file: string;
    rationale: string;
    expectedChange: string;
  };
}

export interface FixResult {
  summary: string;
  patchDescription: string;
  changes: Array<{ file: string; content: string }>;
}

export function parseAnalysisResponse(text: string): AnalysisResult {
  const value = extractJson(text) as Partial<AnalysisResult>;

  if (
    typeof value.architectureSummary !== 'string' ||
    !Array.isArray(value.bugs) ||
    !Array.isArray(value.riskyFiles) ||
    typeof value.recommendedFix !== 'object' ||
    value.recommendedFix === null
  ) {
    throw new Error('LLM analysis response did not match the expected JSON shape.');
  }

  return {
    architectureSummary: value.architectureSummary,
    bugs: value.bugs.map((bug) => ({
      title: requireStringField(bug, 'title', 'bug'),
      severity: normalizeSeverity(requireStringField(bug, 'severity', 'bug')),
      file: requireStringField(bug, 'file', 'bug'),
      evidence: requireStringField(bug, 'evidence', 'bug')
    })),
    riskyFiles: value.riskyFiles.map((riskyFile) => ({
      file: requireStringField(riskyFile, 'file', 'risky file'),
      reason: requireStringField(riskyFile, 'reason', 'risky file')
    })),
    recommendedFix: {
      title: requireStringField(value.recommendedFix, 'title', 'recommended fix'),
      file: requireStringField(value.recommendedFix, 'file', 'recommended fix'),
      rationale: requireStringField(value.recommendedFix, 'rationale', 'recommended fix'),
      expectedChange: requireStringField(value.recommendedFix, 'expectedChange', 'recommended fix')
    }
  };
}

export function parseFixResponse(text: string): FixResult {
  const value = extractJson(text) as Partial<FixResult>;

  if (
    typeof value.summary !== 'string' ||
    typeof value.patchDescription !== 'string' ||
    !Array.isArray(value.changes)
  ) {
    throw new Error('LLM fix response did not match the expected JSON shape.');
  }

  return {
    summary: value.summary,
    patchDescription: value.patchDescription,
    changes: value.changes.map((change) => ({
      file: requireStringField(change, 'file', 'change'),
      content: requireStringField(change, 'content', 'change')
    }))
  };
}

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1] ?? text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);

  if (!candidate || candidate.trim() === '') {
    throw new Error('No JSON object found in LLM response.');
  }

  return JSON.parse(candidate);
}

function requireStringField(value: unknown, field: string, context: string): string {
  if (!isRecord(value) || typeof value[field] !== 'string') {
    throw new Error(`Expected ${context}.${field} to be a string.`);
  }

  return value[field];
}

function normalizeSeverity(value: string): AnalysisResult['bugs'][number]['severity'] {
  if (value === 'low' || value === 'medium' || value === 'high' || value === 'critical') {
    return value;
  }

  return 'medium';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

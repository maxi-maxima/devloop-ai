import { AiProvider } from '../ai/providers/index.js';
import { Diagnosis } from './types.js';

export interface DiagnoseInput {
  log: string;
  repoPath: string;
  provider?: AiProvider;
  context?: string;
}

const FILE_PATTERN = /(?:^|\s|\()((?:[A-Za-z]:)?[A-Za-z0-9_.@/\\-]+\.(?:ts|tsx|js|jsx|mjs|cjs|py|json|md|yml|yaml))(?::\d+)?(?::\d+)?/g;

export async function diagnoseCiFailure(input: DiagnoseInput): Promise<Diagnosis> {
  const deterministic = deterministicDiagnosis(input.log);

  if (!input.provider) {
    return deterministic;
  }

  const response = await input.provider.complete(
    [
      'Analyze this CI failure log and return STRICT JSON matching the documented diagnosis schema.',
      'Repository context:',
      input.context ?? '(not provided)',
      'CI log:',
      input.log
    ].join('\n\n')
  );

  try {
    return normalizeDiagnosis(JSON.parse(stripCodeFence(response)));
  } catch {
    return deterministic;
  }
}

function deterministicDiagnosis(log: string): Diagnosis {
  const lines = log.split(/\r?\n/).map((line) => line.trimEnd());
  const failingCommand = extractCommand(lines);
  const failingTests = extractFailingTests(lines);
  const errorMessages = lines
    .filter((line) => /\b(error|assertionerror|typeerror|referenceerror|syntaxerror|failed|fail)\b/i.test(line))
    .slice(0, 12);
  const stackTraces = lines.filter((line) => /^\s*at\s+/.test(line) || /\([^)]*:\d+:\d+\)/.test(line)).slice(0, 12);
  const likelyFiles = extractLikelyFiles(log);
  const strongestError =
    errorMessages.find((line) => /\b(error|assertionerror)\b/i.test(line)) ??
    errorMessages[0] ??
    'CI command failed';

  return {
    summary: strongestError.slice(0, 180),
    failing_command: failingCommand,
    failing_tests: failingTests,
    error_messages: errorMessages,
    stack_traces: stackTraces,
    likely_files: likelyFiles,
    root_cause_hypothesis: `${strongestError}. Inspect the referenced files and apply the smallest change that addresses this failure.`,
    confidence: likelyFiles.length > 0 || errorMessages.length > 0 ? 0.66 : 0.35,
    recommended_fix_strategy:
      'Use the failing assertion, stack trace, and referenced files to produce a minimal targeted patch.',
    needs_human_review: likelyFiles.length === 0
  };
}

function extractCommand(lines: string[]): string {
  const scriptCommand = lines.find((line) => /^>\s+[^@][\w-]+(?:\s|$)/.test(line));
  if (scriptCommand) {
    return scriptCommand.replace(/^>\s+/, '').trim();
  }

  const shellCommand = lines.find((line) => /^\$?\s*(npm|pnpm|yarn|pytest|python|node)\b/.test(line.trim()));
  return shellCommand?.replace(/^\$\s*/, '').trim() ?? '';
}

function extractFailingTests(lines: string[]): string[] {
  const tests = new Set<string>();

  for (const line of lines) {
    const failMatch = line.match(/^(?:FAIL|FAILED)\s+(.+)$/i);
    if (failMatch) {
      tests.add(failMatch[1]!.trim());
    }

    const vitestMatch = line.match(/^\s*[×✕x]\s+(.+)$/i);
    if (vitestMatch) {
      tests.add(vitestMatch[1]!.trim());
    }

    const pytestMatch = line.match(/_{2,}\s+(.+?)\s+_{2,}/);
    if (pytestMatch) {
      tests.add(pytestMatch[1]!.trim());
    }
  }

  return [...tests].slice(0, 10);
}

function extractLikelyFiles(log: string): string[] {
  const files = new Set<string>();
  for (const match of log.matchAll(FILE_PATTERN)) {
      const file = normalizeLikelyFile(match[1]!);
    if (
      !file.includes('node:') &&
      !file.includes('node_modules') &&
      !file.includes('..') &&
      file !== 'Node.js'
    ) {
      files.add(file);
    }
  }

  return [...files].slice(0, 20);
}

function normalizeDiagnosis(value: Partial<Diagnosis>): Diagnosis {
  return {
    summary: stringOr(value.summary, 'CI failure detected'),
    failing_command: stringOr(value.failing_command, ''),
    failing_tests: arrayOfStrings(value.failing_tests),
    error_messages: arrayOfStrings(value.error_messages),
    stack_traces: arrayOfStrings(value.stack_traces),
    likely_files: arrayOfStrings(value.likely_files),
    root_cause_hypothesis: stringOr(value.root_cause_hypothesis, 'Unknown root cause'),
    confidence: typeof value.confidence === 'number' ? Math.max(0, Math.min(1, value.confidence)) : 0.5,
    recommended_fix_strategy: stringOr(value.recommended_fix_strategy, 'Apply a minimal targeted fix.'),
    needs_human_review: Boolean(value.needs_human_review)
  };
}

function normalizeLikelyFile(file: string): string {
  const normalized = file.replace(/\\/g, '/');
  const srcIndex = normalized.lastIndexOf('/src/');
  if (srcIndex >= 0) {
    return normalized.slice(srcIndex + 1);
  }

  const testIndex = normalized.lastIndexOf('/test/');
  if (testIndex >= 0) {
    return normalized.slice(testIndex + 1);
  }

  return normalized.replace(/^[A-Za-z]:\//, '');
}

function stripCodeFence(text: string): string {
  return text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
}

function stringOr(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function arrayOfStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

import { AutoFixResult } from './types.js';

export function formatDemoAutoFixResult(result: AutoFixResult): string {
  const diagnosis = result.diagnosis;
  const files = result.changedFiles.length > 0 ? result.changedFiles : result.safety.changedFiles;
  const testResult = result.testResult;
  const patchLines = result.patch?.split(/\r?\n/).filter(Boolean).length ?? 0;

  return [
    'DevLoop CI AutoFix',
    '==================',
    '',
    'Diagnosis',
    `  ${diagnosis.summary}`,
    '',
    'Suspected root cause',
    `  ${diagnosis.root_cause_hypothesis}`,
    `  Confidence: ${Math.round(diagnosis.confidence * 100)}%`,
    '',
    'Files to patch',
    ...(files.length > 0 ? files.map((file) => `  - ${file}`) : ['  - none']),
    '',
    'Patch summary',
    `  ${result.patch ? `${patchLines} unified diff lines generated` : 'No patch generated'}`,
    `  Safety: ${result.safety.passed ? 'passed' : 'failed'}`,
    '',
    'Test result',
    testResult
      ? `  ${testResult.command}: ${testResult.passed ? 'passed' : 'failed'} (${testResult.durationMs}ms)`
      : '  Not run in dry-run mode',
    '',
    finalLine(result)
  ].join('\n');
}

function finalLine(result: AutoFixResult): string {
  if (result.status === 'fixed') {
    return 'Success: DevLoop generated a safe patch and the tests now pass.';
  }
  if (result.status === 'dry-run') {
    return 'Dry run complete: patch preview is ready for review.';
  }
  return `Stopped: ${result.reason ?? result.status}`;
}

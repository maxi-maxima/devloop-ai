import { describe, expect, test } from 'vitest';
import { formatDemoAutoFixResult } from './demo-output.js';
import { AutoFixResult } from './types.js';

describe('formatDemoAutoFixResult', () => {
  test('renders asciinema-friendly autofix output', () => {
    const result: AutoFixResult = {
      status: 'fixed',
      attempts: 1,
      diagnosis: {
        summary: 'TypeError: user.name.trim is not a function',
        failing_command: 'npm test',
        failing_tests: ['formatUser returns a display name'],
        error_messages: ['TypeError: user.name.trim is not a function'],
        stack_traces: ['at formatUser (src/user.js:2:20)'],
        likely_files: ['src/user.js', 'test/user.test.js'],
        root_cause_hypothesis: 'formatUser assumes every user has a string name.',
        confidence: 0.82,
        recommended_fix_strategy: 'Default missing names before trimming.',
        needs_human_review: false
      },
      patch: '--- a/src/user.js\n+++ b/src/user.js\n',
      changedFiles: ['src/user.js'],
      safety: {
        passed: true,
        errors: [],
        warnings: [],
        changedFiles: ['src/user.js'],
        forbiddenFiles: []
      },
      testResult: {
        command: 'npm test',
        exitCode: 0,
        stdout: 'tests passed',
        stderr: '',
        durationMs: 100,
        passed: true,
        timedOut: false
      }
    };

    const output = formatDemoAutoFixResult(result);

    expect(output).toContain('DevLoop CI AutoFix');
    expect(output).toContain('Diagnosis');
    expect(output).toContain('Suspected root cause');
    expect(output).toContain('Files to patch');
    expect(output).toContain('Patch summary');
    expect(output).toContain('Test result');
    expect(output).toContain('Success');
  });
});

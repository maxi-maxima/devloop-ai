import { describe, expect, test } from 'vitest';
import { diagnoseCiFailure } from './diagnoser.js';

describe('diagnoseCiFailure', () => {
  test('extracts command, failing tests, errors, stack traces, and likely files from CI logs', async () => {
    const log = [
      '> failing-node-repo@1.0.0 test',
      '> node test.js',
      'FAIL test.js',
      '× add returns a sum',
      'AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:',
      'at Object.<anonymous> (test.js:4:8)',
      'at Module._compile (node:internal/modules/cjs/loader:1730:14)',
      'Error: expected 5 but received -1',
      'src/math.js:2:10'
    ].join('\n');

    const diagnosis = await diagnoseCiFailure({ log, repoPath: process.cwd() });

    expect(diagnosis.failing_command).toBe('node test.js');
    expect(diagnosis.failing_tests).toContain('add returns a sum');
    expect(diagnosis.error_messages).toEqual(
      expect.arrayContaining([
        expect.stringContaining('AssertionError'),
        expect.stringContaining('expected 5')
      ])
    );
    expect(diagnosis.stack_traces[0]).toContain('test.js:4:8');
    expect(diagnosis.likely_files).toEqual(expect.arrayContaining(['test.js', 'src/math.js']));
    expect(diagnosis.root_cause_hypothesis).toContain('AssertionError');
  });

  test('recognizes TypeError and Windows stack paths', async () => {
    const log = [
      '> node test/user.test.js',
      "TypeError: Cannot read properties of undefined (reading 'trim')",
      'at formatUser (C:\\Users\\1\\AppData\\Local\\Temp\\devloop-demo\\src\\user.js:2:26)',
      'at Object.<anonymous> (C:\\Users\\1\\AppData\\Local\\Temp\\devloop-demo\\test\\user.test.js:5:14)'
    ].join('\n');

    const diagnosis = await diagnoseCiFailure({ log, repoPath: process.cwd() });

    expect(diagnosis.summary).toContain('TypeError');
    expect(diagnosis.likely_files).toEqual(
      expect.arrayContaining(['src/user.js', 'test/user.test.js'])
    );
  });
});

import { describe, expect, test } from 'vitest';
import { runTestCommand } from './test-runner.js';

describe('runTestCommand', () => {
  test('returns structured success results', async () => {
    const result = await runTestCommand(process.cwd(), 'node -e "console.log(42)"');

    expect(result.passed).toBe(true);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('42');
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  test('returns structured failure results', async () => {
    const result = await runTestCommand(process.cwd(), 'node -e "console.error(\'bad\'); process.exit(2)"');

    expect(result.passed).toBe(false);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain('bad');
  });
});

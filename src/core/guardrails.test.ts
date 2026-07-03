import { describe, expect, test } from 'vitest';
import { validatePatchSafety } from './guardrails.js';

describe('validatePatchSafety', () => {
  test('rejects patches touching env or secret files', () => {
    const safety = validatePatchSafety(`--- a/.env\n+++ b/.env\n@@ -1 +1 @@\n-OLD=1\n+OLD=2\n`);

    expect(safety.passed).toBe(false);
    expect(safety.errors.join('\n')).toMatch(/forbidden/i);
  });

  test('rejects lockfile edits unless explicitly allowed', () => {
    const patch = `--- a/package-lock.json\n+++ b/package-lock.json\n@@ -1 +1 @@\n-{}\n+{"changed":true}\n`;

    expect(validatePatchSafety(patch).passed).toBe(false);
    expect(validatePatchSafety(patch, { allowLockfile: true }).passed).toBe(true);
  });

  test('rejects patches touching too many files', () => {
    const patch = Array.from({ length: 3 }, (_, index) =>
      `--- a/file${index}.js\n+++ b/file${index}.js\n@@ -1 +1 @@\n-old\n+new\n`
    ).join('\n');

    const safety = validatePatchSafety(patch, { maxFiles: 2 });

    expect(safety.passed).toBe(false);
    expect(safety.errors.join('\n')).toContain('too many files');
  });
});

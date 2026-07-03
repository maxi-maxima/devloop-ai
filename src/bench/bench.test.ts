import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import { aggregateBenchmarkResults } from './aggregate.js';
import { loadBenchmarkSuite } from './loader.js';
import { renderHtmlReport, renderMarkdownReport } from './reporter.js';
import { runBenchmarkSuite } from './runner.js';

const tempDirs: string[] = [];

describe('FixBench', () => {
  afterEach(async () => {
    await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
    tempDirs.length = 0;
  });

  test('loads the default suite with at least 20 benchmark cases', async () => {
    const suite = await loadBenchmarkSuite(path.resolve('benchmarks/fixbench'));

    expect(suite.name).toBe('FixBench');
    expect(suite.cases.length).toBeGreaterThanOrEqual(20);
    expect(new Set(suite.cases.map((testCase) => testCase.category)).size).toBeGreaterThanOrEqual(20);
  });

  test('aggregates pass rates, medians, attempts, and changed-file metrics', () => {
    const summary = aggregateBenchmarkResults([
      {
        caseId: 'a',
        language: 'node',
        category: 'assertion failure',
        difficulty: 'easy',
        status: 'solved',
        attempts: 1,
        runtimeMs: 100,
        filesChanged: ['src/a.js'],
        linesChanged: 2
      },
      {
        caseId: 'b',
        language: 'python',
        category: 'import error',
        difficulty: 'medium',
        status: 'solved',
        attempts: 3,
        runtimeMs: 300,
        filesChanged: ['b.py', 'test_b.py'],
        linesChanged: 4
      },
      {
        caseId: 'c',
        language: 'typescript',
        category: 'type error',
        difficulty: 'hard',
        status: 'failed',
        attempts: 3,
        runtimeMs: 500,
        filesChanged: [],
        linesChanged: 0,
        failureReason: 'still failing'
      }
    ]);

    expect(summary.totalCases).toBe(3);
    expect(summary.solvedCases).toBe(2);
    expect(summary.passAt1).toBeCloseTo(1 / 3);
    expect(summary.passAt3).toBeCloseTo(2 / 3);
    expect(summary.averageAttempts).toBeCloseTo(7 / 3);
    expect(summary.medianRuntimeMs).toBe(300);
    expect(summary.medianFilesChanged).toBe(1);
    expect(summary.medianLinesChanged).toBe(2);
  });

  test('runs a fixture-oracle benchmark case and writes reproducible reports', async () => {
    const suitePath = await createMiniSuite();
    const outputPath = path.join(await makeTempDir('fixbench-output-'), 'results');

    const report = await runBenchmarkSuite({
      suitePath,
      outputPath,
      provider: 'fixture',
      maxRetries: 1,
      concurrency: 1,
      keepWorkdir: false
    });

    expect(report.summary.totalCases).toBe(1);
    expect(report.summary.solvedCases).toBe(1);
    expect(report.cases[0]).toMatchObject({
      caseId: 'mini-js-nullish',
      status: 'solved',
      filesChanged: ['src/index.js']
    });
    await expect(readFile(path.join(outputPath, 'results.json'), 'utf8')).resolves.toContain('mini-js-nullish');
    await expect(readFile(path.join(outputPath, 'report.md'), 'utf8')).resolves.toContain('| Model | Pass@1 |');
    await expect(readFile(path.join(outputPath, 'report.html'), 'utf8')).resolves.toContain('<table');

    expect(renderMarkdownReport(report)).toContain('mini-js-nullish');
    expect(renderHtmlReport(report)).toContain('FixBench Report');
  });
});

async function createMiniSuite(): Promise<string> {
  const root = await makeTempDir('fixbench-suite-');
  const fixture = path.join(root, 'node', 'mini-js-nullish', 'repo');
  await mkdir(path.join(fixture, 'src'), { recursive: true });
  await writeFile(
    path.join(root, 'metadata.json'),
    `${JSON.stringify(
      {
        name: 'FixBench',
        version: '0.1.0',
        cases: [
          {
            id: 'mini-js-nullish',
            language: 'node',
            category: 'null/undefined handling bug',
            difficulty: 'easy',
            fixture: 'node/mini-js-nullish/repo',
            failingCommand: 'node test.js',
            testCommand: 'node test.js',
            bugDescription: 'Greeting formatter crashes when name is missing.',
            allowedFiles: ['src/index.js'],
            expectedChangedFiles: ['src/index.js'],
            successCondition: 'node test.js passes',
            patch: 'node/mini-js-nullish/patch.diff'
          }
        ]
      },
      null,
      2
    )}\n`,
    'utf8'
  );
  await writeFile(path.join(fixture, 'src', 'index.js'), "exports.greet = (user) => 'Hi ' + user.name.trim();\n", 'utf8');
  await writeFile(
    path.join(fixture, 'test.js'),
    "const assert = require('node:assert');\nconst { greet } = require('./src');\nassert.equal(greet({}), 'Hi Anonymous');\n",
    'utf8'
  );
  await writeFile(
    path.join(root, 'node', 'mini-js-nullish', 'patch.diff'),
    [
      '--- a/src/index.js',
      '+++ b/src/index.js',
      '@@ -1 +1 @@',
      "-exports.greet = (user) => 'Hi ' + user.name.trim();",
      "+exports.greet = (user) => 'Hi ' + (user.name ?? 'Anonymous').trim();",
      ''
    ].join('\n'),
    'utf8'
  );
  return root;
}

async function makeTempDir(prefix: string): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

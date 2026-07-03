import { cp, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createAiProvider, providerConfigFromEnv, type AiProvider } from '../ai/providers/index.js';
import { runAutoFix } from '../core/autofix.js';
import { runTestCommand } from '../core/test-runner.js';
import { readTextFile } from '../utils/text-file.js';
import { aggregateBenchmarkResultsWithMetadata } from './aggregate.js';
import { FixturePatchProvider } from './fixture-provider.js';
import { loadBenchmarkSuite } from './loader.js';
import { writeBenchmarkReports } from './reporter.js';
import {
  BenchmarkCase,
  BenchmarkCaseResult,
  BenchmarkReport,
  BenchmarkRunOptions
} from './types.js';

export async function runBenchmarkSuite(options: BenchmarkRunOptions): Promise<BenchmarkReport> {
  const suite = await loadBenchmarkSuite(options.suitePath);
  const selected = options.caseIds?.length
    ? suite.cases.filter((testCase) => options.caseIds!.includes(testCase.id))
    : suite.cases;
  const results = await mapWithConcurrency(selected, Math.max(1, options.concurrency), (testCase) =>
    runBenchmarkCase(testCase, {
      suiteRoot: suite.rootPath,
      outputPath: options.outputPath,
      provider: options.provider,
      model: options.model,
      maxRetries: options.maxRetries,
      keepWorkdir: options.keepWorkdir
    })
  );
  const summary = await aggregateBenchmarkResultsWithMetadata({
    results,
    provider: options.provider,
    model: options.model
  });
  const report: BenchmarkReport = {
    suite: {
      name: suite.name,
      version: suite.version,
      path: suite.rootPath
    },
    summary,
    cases: results
  };
  await writeBenchmarkReports(report, options.outputPath);
  return report;
}

async function runBenchmarkCase(
  testCase: BenchmarkCase,
  options: {
    suiteRoot: string;
    outputPath: string;
    provider: string;
    model?: string;
    maxRetries: number;
    keepWorkdir?: boolean;
  }
): Promise<BenchmarkCaseResult> {
  const started = Date.now();
  const caseOutput = path.join(options.outputPath, 'cases', testCase.id);
  await mkdir(caseOutput, { recursive: true });
  const workdir = await mkdtemp(path.join(tmpdir(), `fixbench-${testCase.id}-`));
  const repoPath = path.join(workdir, 'repo');

  try {
    await cp(path.join(options.suiteRoot, testCase.fixture), repoPath, { recursive: true });
    if (testCase.installCommand) {
      await runTestCommand(repoPath, normalizeCommand(testCase.installCommand));
    }
    const failing = await runTestCommand(repoPath, normalizeCommand(testCase.failingCommand));
    await writeFile(path.join(caseOutput, 'failing.log'), [failing.stdout, failing.stderr].join('\n'), 'utf8');
    if (failing.passed) {
      return baseResult(testCase, {
        status: 'skipped',
        attempts: 0,
        runtimeMs: Date.now() - started,
        failureReason: 'Expected failing command passed before DevLoop ran.',
        workdir: options.keepWorkdir ? repoPath : undefined
      });
    }

    const provider = await createBenchmarkProvider(testCase, options);
    const result = await runAutoFix({
      repoPath,
      log: [failing.stdout, failing.stderr].join('\n'),
      testCommand: normalizeCommand(testCase.testCommand),
      maxRetries: options.maxRetries,
      dryRun: false,
      noPr: true,
      provider,
      allowLockfile: false,
      maxFiles: testCase.allowedFiles.length || 5,
      evidenceRoot: path.join(caseOutput, 'evidence'),
      evidenceTrigger: {
        type: 'bench.autofix',
        repository: testCase.id
      }
    });
    const patch = result.patch ?? '';
    const patchPath = path.join(caseOutput, 'patch.diff');
    await writeFile(patchPath, patch, 'utf8');
    await writeFile(path.join(caseOutput, 'result.json'), `${JSON.stringify(result, null, 2)}\n`, 'utf8');

    const status = result.status === 'fixed' ? 'solved' : result.status === 'unsafe' ? 'unsafe' : 'failed';
    const unexpectedFiles = result.changedFiles.filter((file) => !testCase.allowedFiles.includes(file));
    const missingExpected = testCase.expectedChangedFiles.filter((file) => !result.changedFiles.includes(file));
    const failureReason =
      status === 'solved' && unexpectedFiles.length === 0 && missingExpected.length === 0
        ? undefined
        : [
            result.reason,
            unexpectedFiles.length ? `Changed files outside allowlist: ${unexpectedFiles.join(', ')}` : '',
            missingExpected.length ? `Expected changed files missing: ${missingExpected.join(', ')}` : ''
          ]
            .filter(Boolean)
            .join('\n') || undefined;

    return baseResult(testCase, {
      status: failureReason && status === 'solved' ? 'failed' : status,
      attempts: result.attempts,
      runtimeMs: Date.now() - started,
      diagnosisSummary: result.diagnosis.summary,
      diagnosis: result.diagnosis,
      filesChanged: result.changedFiles,
      linesChanged: countChangedLines(patch),
      testResult: result.testResult,
      safety: result.safety,
      failureReason,
      patchDiffPath: patchPath,
      evidencePath: result.evidence?.path,
      workdir: options.keepWorkdir ? repoPath : undefined,
      autoFixStatus: result.status
    });
  } catch (error) {
    return baseResult(testCase, {
      status: 'failed',
      attempts: options.maxRetries,
      runtimeMs: Date.now() - started,
      failureReason: error instanceof Error ? error.message : String(error),
      workdir: options.keepWorkdir ? repoPath : undefined
    });
  } finally {
    if (!options.keepWorkdir) {
      await rm(workdir, { recursive: true, force: true });
    }
  }
}

async function createBenchmarkProvider(
  testCase: BenchmarkCase,
  options: { suiteRoot: string; provider: string; model?: string }
): Promise<AiProvider> {
  if (options.provider === 'fixture') {
    if (!testCase.patch) {
      throw new Error(`Fixture provider requires a patch file for case ${testCase.id}.`);
    }
    return new FixturePatchProvider(await readTextFile(path.join(options.suiteRoot, testCase.patch)));
  }
  if (options.provider !== 'openai' && options.provider !== 'anthropic' && options.provider !== 'ollama') {
    throw new Error(`Unsupported benchmark provider: ${options.provider}`);
  }
  return createAiProvider(providerConfigFromEnv(options.provider, options.model));
}

function baseResult(
  testCase: BenchmarkCase,
  result: Partial<BenchmarkCaseResult> & Pick<BenchmarkCaseResult, 'status' | 'attempts' | 'runtimeMs'>
): BenchmarkCaseResult {
  return {
    caseId: testCase.id,
    language: testCase.language,
    category: testCase.category,
    difficulty: testCase.difficulty,
    status: result.status,
    attempts: result.attempts,
    runtimeMs: result.runtimeMs,
    diagnosisSummary: result.diagnosisSummary,
    diagnosis: result.diagnosis,
    filesChanged: result.filesChanged ?? [],
    linesChanged: result.linesChanged ?? 0,
    testResult: result.testResult,
    safety: result.safety,
    failureReason: result.failureReason,
    patchDiffPath: result.patchDiffPath,
    evidencePath: result.evidencePath,
    workdir: result.workdir,
    autoFixStatus: result.autoFixStatus
  };
}

function countChangedLines(patch: string): number {
  return patch
    .split(/\r?\n/)
    .filter((line) => (/^\+/.test(line) && !line.startsWith('+++')) || (/^-/.test(line) && !line.startsWith('---')))
    .length;
}

function normalizeCommand(command: string): string {
  return command.replaceAll('__DEVLOOP_ROOT__', process.cwd());
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  callback: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let index = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (index < items.length) {
      const current = index++;
      results[current] = await callback(items[current]!);
    }
  });
  await Promise.all(workers);
  return results;
}

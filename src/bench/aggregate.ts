import os from 'node:os';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { BenchmarkCaseResult, BenchmarkSummary } from './types.js';

export async function aggregateBenchmarkResultsWithMetadata(input: {
  results: BenchmarkCaseResult[];
  provider: string;
  model?: string;
}): Promise<BenchmarkSummary> {
  const summary = aggregateBenchmarkResults(input.results);
  return {
    ...summary,
    provider: input.provider,
    model: input.model ?? (input.provider === 'fixture' ? 'fixture-oracle' : 'default'),
    devloopVersion: await readDevLoopVersion(),
    timestamp: new Date().toISOString(),
    machine: {
      platform: process.platform,
      arch: process.arch,
      node: process.version,
      cpuCount: os.cpus().length
    }
  };
}

export function aggregateBenchmarkResults(
  results: BenchmarkCaseResult[]
): Omit<BenchmarkSummary, 'model' | 'provider' | 'devloopVersion' | 'timestamp' | 'machine'> {
  const totalCases = results.length;
  const solved = results.filter((result) => result.status === 'solved');
  const failed = results.filter((result) => result.status === 'failed');
  const unsafe = results.filter((result) => result.status === 'unsafe');

  return {
    passAt1: totalCases === 0 ? 0 : solved.filter((result) => result.attempts <= 1).length / totalCases,
    passAt3: totalCases === 0 ? 0 : solved.filter((result) => result.attempts <= 3).length / totalCases,
    totalCases,
    solvedCases: solved.length,
    failedCases: failed.length,
    unsafePatchRejections: unsafe.length,
    averageAttempts:
      totalCases === 0 ? 0 : results.reduce((sum, result) => sum + result.attempts, 0) / totalCases,
    medianRuntimeMs: median(results.map((result) => result.runtimeMs)),
    medianFilesChanged: median(results.map((result) => result.filesChanged.length)),
    medianLinesChanged: median(results.map((result) => result.linesChanged))
  };
}

function median(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1]! + sorted[middle]!) / 2 : sorted[middle]!;
}

async function readDevLoopVersion(): Promise<string> {
  const packageJson = JSON.parse(await readFile(path.resolve('package.json'), 'utf8')) as { version?: string };
  return packageJson.version ?? '0.0.0';
}

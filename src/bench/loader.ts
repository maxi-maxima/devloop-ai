import path from 'node:path';
import { readTextFile } from '../utils/text-file.js';
import { BenchmarkCase, BenchmarkSuite } from './types.js';

export async function loadBenchmarkSuite(suitePath: string): Promise<BenchmarkSuite> {
  const rootPath = path.resolve(suitePath);
  const metadataPath = path.join(rootPath, 'metadata.json');
  const metadata = JSON.parse(await readTextFile(metadataPath)) as {
    name?: string;
    version?: string;
    cases?: BenchmarkCase[];
  };

  if (!metadata.name || !metadata.version || !Array.isArray(metadata.cases)) {
    throw new Error(`Invalid FixBench metadata: ${metadataPath}`);
  }

  const seen = new Set<string>();
  const cases = metadata.cases.map((testCase) => validateCase(testCase, seen));
  return {
    name: metadata.name,
    version: metadata.version,
    rootPath,
    cases
  };
}

function validateCase(testCase: BenchmarkCase, seen: Set<string>): BenchmarkCase {
  const required: Array<keyof BenchmarkCase> = [
    'id',
    'language',
    'category',
    'difficulty',
    'fixture',
    'failingCommand',
    'testCommand',
    'bugDescription',
    'allowedFiles',
    'expectedChangedFiles',
    'successCondition'
  ];

  for (const key of required) {
    if (testCase[key] === undefined) {
      throw new Error(`Benchmark case is missing ${key}: ${JSON.stringify(testCase)}`);
    }
  }
  if (seen.has(testCase.id)) {
    throw new Error(`Duplicate benchmark case id: ${testCase.id}`);
  }
  seen.add(testCase.id);
  if (!['easy', 'medium', 'hard'].includes(testCase.difficulty)) {
    throw new Error(`Invalid difficulty for ${testCase.id}: ${testCase.difficulty}`);
  }
  return testCase;
}

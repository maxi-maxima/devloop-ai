import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { FirewallBenchCase, FirewallBenchSuite } from './types.js';

interface Metadata {
  name: string;
  version: string;
  caseFiles: string[];
}

export async function loadFirewallBenchSuite(suitePath: string): Promise<FirewallBenchSuite> {
  const rootPath = path.resolve(suitePath);
  const metadata = JSON.parse(await readFile(path.join(rootPath, 'metadata.json'), 'utf8')) as Metadata;
  const cases = (
    await Promise.all(
      metadata.caseFiles.map(async (file) => JSON.parse(await readFile(path.join(rootPath, file), 'utf8')) as FirewallBenchCase[])
    )
  ).flat();

  validateCases(cases);
  return {
    name: metadata.name,
    version: metadata.version,
    rootPath,
    cases
  };
}

function validateCases(cases: FirewallBenchCase[]): void {
  const ids = new Set<string>();
  for (const testCase of cases) {
    if (ids.has(testCase.id)) {
      throw new Error(`Duplicate FirewallBench case id: ${testCase.id}`);
    }
    ids.add(testCase.id);
    if (!testCase.category || !testCase.kind || !testCase.expectedDecision || !testCase.expectedCategory) {
      throw new Error(`Invalid FirewallBench case: ${testCase.id}`);
    }
    if (testCase.kind === 'input' && (!testCase.text || !testCase.source)) {
      throw new Error(`Input case requires source and text: ${testCase.id}`);
    }
    if (testCase.kind === 'command' && !testCase.command) {
      throw new Error(`Command case requires command: ${testCase.id}`);
    }
    if (testCase.kind === 'patch' && !testCase.patch) {
      throw new Error(`Patch case requires patch: ${testCase.id}`);
    }
  }
}

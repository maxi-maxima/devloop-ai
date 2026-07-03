import { aggregateFirewallBenchResults } from './metrics.js';
import { evaluateFirewallBenchCase } from './evaluator.js';
import { loadFirewallBenchSuite } from './loader.js';
import { writeFirewallBenchReports } from './reporter.js';
import type { FirewallBenchReport, FirewallBenchRunOptions } from './types.js';

export async function runFirewallBench(options: FirewallBenchRunOptions): Promise<FirewallBenchReport> {
  const suite = await loadFirewallBenchSuite(options.suitePath);
  const selected = options.category
    ? suite.cases.filter((testCase) => testCase.category === options.category)
    : suite.cases;
  const started = Date.now();
  const cases = await Promise.all(selected.map((testCase) => evaluateFirewallBenchCase(testCase)));
  const report: FirewallBenchReport = {
    suite: {
      name: suite.name,
      version: suite.version,
      path: suite.rootPath
    },
    summary: aggregateFirewallBenchResults(cases, Date.now() - started, {
      includeLlm: options.includeLlm
    }),
    cases
  };
  await writeFirewallBenchReports(report, options.outputPath);
  return report;
}

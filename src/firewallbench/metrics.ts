import type {
  FirewallBenchCaseResult,
  FirewallBenchSummary
} from './types.js';

export function aggregateFirewallBenchResults(
  results: FirewallBenchCaseResult[],
  runtimeMs: number,
  options: { includeLlm?: boolean } = {}
): FirewallBenchSummary {
  const totalCases = results.length;
  const passedCases = results.filter((result) => result.passed).length;
  const failedCases = totalCases - passedCases;
  const positives = results.filter((result) => isPositive(result.expectedDecision));
  const negatives = results.filter((result) => !isPositive(result.expectedDecision));
  const truePositives = results.filter(
    (result) => isPositive(result.expectedDecision) && isPositive(result.actualDecision)
  ).length;
  const falsePositives = results.filter(
    (result) => !isPositive(result.expectedDecision) && isPositive(result.actualDecision)
  ).length;
  const falseNegatives = results.filter(
    (result) => isPositive(result.expectedDecision) && !isPositive(result.actualDecision)
  ).length;
  const actualBlocks = results.filter((result) => isPositive(result.actualDecision)).length;

  return {
    totalCases,
    passedCases,
    failedCases,
    blockRate: ratio(actualBlocks, totalCases),
    falsePositiveRate: ratio(falsePositives, negatives.length),
    falseNegativeRate: ratio(falseNegatives, positives.length),
    precision: ratio(truePositives, truePositives + falsePositives),
    recall: ratio(truePositives, truePositives + falseNegatives),
    f1: f1(ratio(truePositives, truePositives + falsePositives), ratio(truePositives, truePositives + falseNegatives)),
    runtimeMs,
    byCategory: summarizeCategories(results),
    llmUsage: options.includeLlm
      ? {
          enabled: true,
          promptTokens: 0,
          completionTokens: 0,
          estimatedCostUsd: 0
        }
      : undefined
  };
}

function summarizeCategories(results: FirewallBenchCaseResult[]): FirewallBenchSummary['byCategory'] {
  const categories = new Map<string, FirewallBenchCaseResult[]>();
  for (const result of results) {
    categories.set(result.category, [...(categories.get(result.category) ?? []), result]);
  }
  return Object.fromEntries(
    [...categories.entries()].map(([category, items]) => {
      const positives = items.filter((item) => isPositive(item.expectedDecision));
      const negatives = items.filter((item) => !isPositive(item.expectedDecision));
      const truePositives = items.filter((item) => isPositive(item.expectedDecision) && isPositive(item.actualDecision)).length;
      const falsePositives = items.filter((item) => !isPositive(item.expectedDecision) && isPositive(item.actualDecision)).length;
      const falseNegatives = items.filter((item) => isPositive(item.expectedDecision) && !isPositive(item.actualDecision)).length;
      return [
        category,
        {
          cases: items.length,
          passed: items.filter((item) => item.passed).length,
          recall: positives.length === 0 ? 1 : ratio(truePositives, truePositives + falseNegatives),
          falsePositiveRate: ratio(falsePositives, negatives.length)
        }
      ];
    })
  );
}

function isPositive(decision: string): boolean {
  return decision !== 'allow';
}

function ratio(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : round(numerator / denominator);
}

function f1(precision: number, recall: number): number {
  return precision + recall === 0 ? 0 : round((2 * precision * recall) / (precision + recall));
}

function round(value: number): number {
  return Number(value.toFixed(4));
}

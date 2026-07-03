import {
  checkCommandRisk,
  checkInput,
  checkPatchRisk,
  type FirewallResult
} from '../firewall/index.js';
import type { RiskLevel } from '../firewall/types.js';
import type { FirewallBenchCase, FirewallBenchCaseResult } from './types.js';

const riskOrder: RiskLevel[] = ['low', 'medium', 'high', 'critical'];

export async function evaluateFirewallBenchCase(testCase: FirewallBenchCase): Promise<FirewallBenchCaseResult> {
  const actual = evaluateCase(testCase);
  const matchedCategory =
    testCase.expectedCategory === 'none'
      ? actual.findings.length === 0
      : actual.findings.some((finding) => finding.category === testCase.expectedCategory);
  const matchedSeverity = riskOrder.indexOf(actual.riskLevel) >= riskOrder.indexOf(testCase.expectedMinSeverity);
  const matchedDecision = actual.decision === testCase.expectedDecision;
  const passed = matchedDecision && matchedCategory && matchedSeverity;

  return {
    id: testCase.id,
    category: testCase.category,
    kind: testCase.kind,
    expectedDecision: testCase.expectedDecision,
    actualDecision: actual.decision,
    expectedCategory: testCase.expectedCategory,
    actualRiskLevel: actual.riskLevel,
    expectedMinSeverity: testCase.expectedMinSeverity,
    matchedCategory,
    matchedSeverity,
    passed,
    explanation: testCase.explanation,
    failureReason: passed
      ? undefined
      : [
          matchedDecision ? '' : `expected decision ${testCase.expectedDecision}, got ${actual.decision}`,
          matchedCategory ? '' : `expected category ${testCase.expectedCategory}`,
          matchedSeverity ? '' : `expected severity >= ${testCase.expectedMinSeverity}, got ${actual.riskLevel}`
        ]
          .filter(Boolean)
          .join('; '),
    findingIds: actual.findings.map((finding) => finding.id)
  };
}

function evaluateCase(testCase: FirewallBenchCase): FirewallResult {
  if (testCase.kind === 'input') {
    return checkInput({ source: testCase.source!, text: testCase.text! });
  }
  if (testCase.kind === 'command') {
    return checkCommandRisk(testCase.command!);
  }
  return checkPatchRisk({ repoPath: process.cwd(), patch: testCase.patch! });
}

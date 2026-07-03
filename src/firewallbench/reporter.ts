import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { FirewallBenchReport } from './types.js';

export async function writeFirewallBenchReports(report: FirewallBenchReport, outputPath: string): Promise<void> {
  await mkdir(outputPath, { recursive: true });
  await writeFile(path.join(outputPath, 'results.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await writeFile(path.join(outputPath, 'report.md'), renderFirewallBenchMarkdown(report), 'utf8');
  await writeFile(path.join(outputPath, 'report.html'), renderFirewallBenchHtml(report), 'utf8');
}

export function renderFirewallBenchMarkdown(report: FirewallBenchReport): string {
  const categoryRows = Object.entries(report.summary.byCategory)
    .map(
      ([category, summary]) =>
        `| ${category} | ${summary.cases} | ${percent(summary.recall)} | ${percent(summary.falsePositiveRate)} |`
    )
    .join('\n');
  const failedRows = report.cases
    .filter((testCase) => !testCase.passed)
    .map(
      (testCase) =>
        `| ${testCase.id} | ${testCase.expectedDecision} | ${testCase.actualDecision} | ${testCase.failureReason ?? '-'} |`
    )
    .join('\n');

  return [
    '# FirewallBench Report',
    '',
    '| Category | Cases | Recall | False Positive Rate |',
    '|---|---:|---:|---:|',
    categoryRows,
    '',
    '## Summary',
    '',
    `- Total cases: ${report.summary.totalCases}`,
    `- Passed cases: ${report.summary.passedCases}`,
    `- Failed cases: ${report.summary.failedCases}`,
    `- Block rate: ${percent(report.summary.blockRate)}`,
    `- False positive rate: ${percent(report.summary.falsePositiveRate)}`,
    `- False negative rate: ${percent(report.summary.falseNegativeRate)}`,
    `- Precision: ${percent(report.summary.precision)}`,
    `- Recall: ${percent(report.summary.recall)}`,
    `- F1: ${percent(report.summary.f1)}`,
    `- Runtime: ${report.summary.runtimeMs} ms`,
    '',
    '## Failed Cases',
    '',
    '| Case | Expected | Actual | Reason |',
    '|---|---|---|---|',
    failedRows || '| - | - | - | - |',
    ''
  ].join('\n');
}

export function renderFirewallBenchHtml(report: FirewallBenchReport): string {
  const categoryRows = Object.entries(report.summary.byCategory)
    .map(
      ([category, summary]) =>
        `<tr><td>${escapeHtml(category)}</td><td>${summary.cases}</td><td>${percent(summary.recall)}</td><td>${percent(summary.falsePositiveRate)}</td></tr>`
    )
    .join('');
  return [
    '<!doctype html>',
    '<html lang="en">',
    '<head><meta charset="utf-8"><title>FirewallBench Report</title>',
    '<style>body{font-family:system-ui,sans-serif;margin:32px;line-height:1.5}table{border-collapse:collapse;width:100%;margin:16px 0}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f5f5f5}</style>',
    '</head><body>',
    '<h1>FirewallBench Report</h1>',
    `<p>Total cases: ${report.summary.totalCases}. Passed: ${report.summary.passedCases}. Recall: ${percent(report.summary.recall)}.</p>`,
    '<table><thead><tr><th>Category</th><th>Cases</th><th>Recall</th><th>False Positive Rate</th></tr></thead><tbody>',
    categoryRows,
    '</tbody></table>',
    '</body></html>',
    ''
  ].join('');
}

function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

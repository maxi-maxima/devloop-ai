import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { BenchmarkReport } from './types.js';

export async function writeBenchmarkReports(report: BenchmarkReport, outputPath: string): Promise<void> {
  await mkdir(outputPath, { recursive: true });
  await writeFile(path.join(outputPath, 'results.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await writeFile(path.join(outputPath, 'report.md'), renderMarkdownReport(report), 'utf8');
  await writeFile(path.join(outputPath, 'report.html'), renderHtmlReport(report), 'utf8');
}

export async function regenerateBenchmarkReports(input: {
  resultsPath: string;
  outputPath?: string;
}): Promise<BenchmarkReport> {
  const report = JSON.parse(await readFile(input.resultsPath, 'utf8')) as BenchmarkReport;
  await writeBenchmarkReports(report, input.outputPath ?? path.dirname(input.resultsPath));
  return report;
}

export function renderMarkdownReport(report: BenchmarkReport): string {
  const rows = report.cases
    .map(
      (result) =>
        `| ${result.caseId} | ${result.language} | ${result.category} | ${result.difficulty} | ${result.status} | ${result.attempts} | ${result.filesChanged.join(', ') || '-'} | ${result.evidencePath ?? '-'} | ${result.failureReason ?? '-'} |`
    )
    .join('\n');

  return [
    '# FixBench Report',
    '',
    benchmarkSummaryTable(report),
    '',
    '## Summary',
    '',
    `- Total cases: ${report.summary.totalCases}`,
    `- Solved cases: ${report.summary.solvedCases}`,
    `- Failed cases: ${report.summary.failedCases}`,
    `- Unsafe patch rejections: ${report.summary.unsafePatchRejections}`,
    `- Average attempts: ${formatNumber(report.summary.averageAttempts)}`,
    `- Median runtime: ${report.summary.medianRuntimeMs} ms`,
    `- Median files changed: ${report.summary.medianFilesChanged}`,
    `- Median lines changed: ${report.summary.medianLinesChanged}`,
    `- Provider/model: ${report.summary.provider}/${report.summary.model}`,
    `- DevLoop version: ${report.summary.devloopVersion}`,
    `- Timestamp: ${report.summary.timestamp}`,
    `- Machine: ${report.summary.machine.platform} ${report.summary.machine.arch}, Node ${report.summary.machine.node}, ${report.summary.machine.cpuCount} CPUs`,
    '',
    '## Cases',
    '',
    '| Case | Language | Category | Difficulty | Status | Attempts | Files Changed | Evidence | Failure Reason |',
    '|---|---|---|---|---|---:|---|---|---|',
    rows,
    ''
  ].join('\n');
}

export function benchmarkSummaryTable(report: BenchmarkReport): string {
  return [
    '| Model | Pass@1 | Pass@3 | Median Time | Median Files Changed |',
    '|---|---:|---:|---:|---:|',
    `| ${report.summary.provider}/${report.summary.model} | ${percent(report.summary.passAt1)} | ${percent(report.summary.passAt3)} | ${report.summary.medianRuntimeMs} ms | ${report.summary.medianFilesChanged} |`
  ].join('\n');
}

export function renderHtmlReport(report: BenchmarkReport): string {
  const caseRows = report.cases
    .map(
      (result) =>
        `<tr><td>${escapeHtml(result.caseId)}</td><td>${escapeHtml(result.language)}</td><td>${escapeHtml(result.category)}</td><td>${escapeHtml(result.difficulty)}</td><td>${escapeHtml(result.status)}</td><td>${result.attempts}</td><td>${escapeHtml(result.filesChanged.join(', ') || '-')}</td><td>${escapeHtml(result.evidencePath ?? '-')}</td><td>${escapeHtml(result.failureReason ?? '-')}</td></tr>`
    )
    .join('');
  return [
    '<!doctype html>',
    '<html lang="en">',
    '<head><meta charset="utf-8"><title>FixBench Report</title>',
    '<style>body{font-family:system-ui,sans-serif;margin:32px;line-height:1.5}table{border-collapse:collapse;width:100%;margin:16px 0}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f5f5f5}.metric{font-size:1.15rem}</style>',
    '</head><body>',
    '<h1>FixBench Report</h1>',
    `<p class="metric">Provider/model: ${escapeHtml(report.summary.provider)}/${escapeHtml(report.summary.model)}</p>`,
    '<table><thead><tr><th>Model</th><th>Pass@1</th><th>Pass@3</th><th>Median Time</th><th>Median Files Changed</th></tr></thead><tbody>',
    `<tr><td>${escapeHtml(report.summary.provider)}/${escapeHtml(report.summary.model)}</td><td>${percent(report.summary.passAt1)}</td><td>${percent(report.summary.passAt3)}</td><td>${report.summary.medianRuntimeMs} ms</td><td>${report.summary.medianFilesChanged}</td></tr>`,
    '</tbody></table>',
    '<h2>Cases</h2>',
    '<table><thead><tr><th>Case</th><th>Language</th><th>Category</th><th>Difficulty</th><th>Status</th><th>Attempts</th><th>Files Changed</th><th>Evidence</th><th>Failure Reason</th></tr></thead><tbody>',
    caseRows,
    '</tbody></table>',
    '</body></html>',
    ''
  ].join('');
}

function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

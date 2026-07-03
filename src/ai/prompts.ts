import { AnalysisResult } from './parsing.js';
import { RepositorySnapshot, SnapshotFile } from '../core/snapshot.js';

export function buildAnalysisPrompt(snapshot: RepositorySnapshot): string {
  return `Analyze this GitHub repository snapshot and return JSON only.

Required JSON shape:
{
  "architectureSummary": "short architecture overview",
  "bugs": [{"title": "bug or risk", "severity": "low|medium|high|critical", "file": "path", "evidence": "why"}],
  "riskyFiles": [{"file": "path", "reason": "why risky"}],
  "recommendedFix": {"title": "one concrete fix", "file": "path", "rationale": "why", "expectedChange": "what to change"}
}

Repository tree:
${snapshot.tree.join('\n')}

Selected files:
${renderFiles(snapshot.files)}
`;
}

export function buildFixPrompt(analysis: AnalysisResult, files: SnapshotFile[]): string {
  return `Generate a minimal code fix for the recommended issue.

Return JSON only using this shape:
{
  "summary": "what changed",
  "patchDescription": "human-readable patch description",
  "changes": [{"file": "relative/path", "content": "complete replacement file content"}]
}

Recommended fix:
${JSON.stringify(analysis.recommendedFix, null, 2)}

Known bugs:
${JSON.stringify(analysis.bugs, null, 2)}

Files available for editing:
${renderFiles(files)}
`;
}

function renderFiles(files: SnapshotFile[]): string {
  return files
    .map((file) => `--- ${file.path} ---\n${file.content}`)
    .join('\n\n')
    .slice(0, 120_000);
}

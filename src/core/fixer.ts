import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { LlmClient } from '../ai/client.js';
import { AnalysisResult, FixResult, parseFixResponse } from '../ai/parsing.js';
import { buildFixPrompt } from '../ai/prompts.js';
import { collectFocusedFiles } from './snapshot.js';

export interface FileChange {
  file: string;
  content: string;
}

export async function applyFileChanges(
  repoPath: string,
  changes: FileChange[]
): Promise<string[]> {
  const changedFiles: string[] = [];

  for (const change of changes) {
    const target = resolveInsideRepo(repoPath, change.file);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, change.content, 'utf8');
    changedFiles.push(toPosixPath(change.file));
  }

  return changedFiles;
}

export async function generateAndApplyFix(
  repoPath: string,
  analysis: AnalysisResult,
  client: LlmClient
): Promise<FixResult & { changedFiles: string[] }> {
  const focusedFiles = await collectFocusedFiles(repoPath, [
    analysis.recommendedFix.file,
    ...analysis.riskyFiles.map((file) => file.file)
  ]);
  const response = await client.complete(buildFixPrompt(analysis, focusedFiles));
  const fix = parseFixResponse(response);
  const changedFiles = await applyFileChanges(repoPath, fix.changes);

  return { ...fix, changedFiles };
}

function resolveInsideRepo(repoPath: string, file: string): string {
  const root = path.resolve(repoPath);
  const target = path.resolve(root, file);
  const relative = path.relative(root, target);

  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Refusing to write outside repository: ${file}`);
  }

  return target;
}

function toPosixPath(file: string): string {
  return file.replace(/\\/g, '/');
}

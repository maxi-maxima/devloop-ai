import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { LlmClient } from '../ai/client.js';
import { AnalysisResult, parseAnalysisResponse } from '../ai/parsing.js';
import { buildAnalysisPrompt } from '../ai/prompts.js';
import { collectRepositorySnapshot } from './snapshot.js';

export async function analyzeRepository(
  repoPath: string,
  analysisPath: string,
  client: LlmClient
): Promise<AnalysisResult> {
  const snapshot = await collectRepositorySnapshot(repoPath);
  const response = await client.complete(buildAnalysisPrompt(snapshot));
  const analysis = parseAnalysisResponse(response);

  await mkdir(path.dirname(analysisPath), { recursive: true });
  await writeFile(analysisPath, `${JSON.stringify(analysis, null, 2)}\n`, 'utf8');

  return analysis;
}

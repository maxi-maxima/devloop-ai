import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Diagnosis } from '../core/types.js';
import { SnapshotFile } from '../core/snapshot.js';
import { renderContextFiles } from '../core/context-builder.js';

export async function buildGeneratePatchPrompt(
  diagnosis: Diagnosis,
  files: SnapshotFile[]
): Promise<string> {
  return [
    await loadPrompt('generate-minimal-patch.md', GENERATE_MINIMAL_PATCH),
    'CI diagnosis:',
    JSON.stringify(diagnosis, null, 2),
    'Relevant files:',
    renderContextFiles(files)
  ].join('\n\n');
}

export async function buildPatchReviewPrompt(patch: string): Promise<string> {
  return [await loadPrompt('review-generated-patch.md', REVIEW_GENERATED_PATCH), 'Patch:', patch].join(
    '\n\n'
  );
}

async function loadPrompt(fileName: string, fallback: string): Promise<string> {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(here, 'prompts', fileName),
    path.resolve(here, '..', 'src', 'ai', 'prompts', fileName),
    path.resolve(process.cwd(), 'src', 'ai', 'prompts', fileName)
  ];

  for (const candidate of candidates) {
    try {
      return await readFile(candidate, 'utf8');
    } catch {
      // Keep trying candidates; packaged builds fall back to embedded text.
    }
  }

  return fallback;
}

const GENERATE_MINIMAL_PATCH = `You are an autonomous coding agent fixing a CI failure.

Your job:
Generate the smallest safe unified diff patch that fixes the failure.

Rules:
- Return ONLY unified diff.
- Do not include markdown fences.
- Do not include explanation.
- Modify the fewest files possible.
- Preserve existing style.
- If the failure cannot be fixed safely, return exactly:
  DEVLOOP_CANNOT_FIX_SAFELY`;

const REVIEW_GENERATED_PATCH = `You are a strict code reviewer.

Review this generated patch for correctness, minimality, safety, unrelated changes, security risks, and test adequacy.`;

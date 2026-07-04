import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { validatePatchSafety, SafetyOptions } from './guardrails.js';
import { PatchFile, PatchResult } from './types.js';

export function parseUnifiedDiff(patch: string): PatchFile[] {
  if (patch.trim() === 'DEVLOOP_CANNOT_FIX_SAFELY') {
    throw new Error('LLM reported that the failure cannot be fixed safely.');
  }

  const lines = patch.split(/\r?\n/);
  if (!hasUnifiedDiffMarkers(lines)) {
    throw new Error('Patch must be a valid unified diff.');
  }

  const files: PatchFile[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const oldPath = parseFileHeader(lines[index]!, '---', 'a/');
    if (!oldPath) {
      continue;
    }

    const next = lines[index + 1];
    const newPath = next ? parseFileHeader(next, '+++', 'b/') : undefined;
    if (!newPath) {
      throw new Error('Malformed unified diff: missing +++ file header.');
    }

    files.push({
      oldPath,
      newPath
    });
  }

  if (files.length === 0) {
    throw new Error('Patch must include at least one file header.');
  }
  validateHunkLines(lines);

  return files;
}

export async function previewPatch(
  repoPath: string,
  patch: string,
  options: SafetyOptions = {}
): Promise<PatchResult> {
  const safety = validatePatchSafety(patch, options);
  if (safety.passed) {
    await gitApplyCheck(repoPath, patch);
  }

  return {
    patch,
    changedFiles: safety.changedFiles,
    safety,
    dryRun: true,
    applied: false
  };
}

export async function applyUnifiedDiff(
  repoPath: string,
  patch: string,
  options: SafetyOptions = {}
): Promise<PatchResult> {
  const preview = await previewPatch(repoPath, patch, options);
  if (!preview.safety.passed) {
    return preview;
  }

  await withPatchFile(patch, async (patchPath) => {
    await runGit(repoPath, ['-c', 'core.autocrlf=false', '-c', 'core.eol=lf', 'apply', '-p1', patchPath]);
  });

  return {
    ...preview,
    dryRun: false,
    applied: true
  };
}

async function gitApplyCheck(repoPath: string, patch: string): Promise<void> {
  await withPatchFile(patch, async (patchPath) => {
    await runGit(repoPath, [
      '-c',
      'core.autocrlf=false',
      '-c',
      'core.eol=lf',
      'apply',
      '--check',
      '-p1',
      patchPath
    ]);
  });
}

async function withPatchFile<T>(patch: string, callback: (patchPath: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(path.join(tmpdir(), 'devloop-patch-'));
  const patchPath = path.join(dir, 'patch.diff');
  await writeFile(patchPath, patch, 'utf8');

  try {
    return await callback(patchPath);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function runGit(cwd: string, args: string[]): Promise<void> {
  const result = await new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve) => {
    const child = spawn('git', args, { cwd, shell: false });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });

  if (result.code !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${result.stderr || result.stdout}`);
  }
}

function stripPatchMeta(file: string): string {
  const metaStart = firstWhitespaceIndex(file);
  const clean = metaStart === -1 ? file : file.slice(0, metaStart);
  return clean.replace(/\\/g, '/');
}

function validateHunkLines(lines: string[]): void {
  let inHunk = false;

  for (const line of lines) {
    if (line.startsWith('@@')) {
      inHunk = true;
      continue;
    }

    if (
      line.startsWith('--- ') ||
      line.startsWith('+++ ') ||
      line.startsWith('diff --git ') ||
      line.startsWith('index ')
    ) {
      continue;
    }

    if (inHunk && line !== '' && !isValidHunkLinePrefix(line[0]!)) {
      throw new Error('Malformed unified diff: hunk lines must start with space, +, or -.');
    }
  }
}

function hasUnifiedDiffMarkers(lines: string[]): boolean {
  let hasOldHeader = false;
  let hasNewHeader = false;
  let hasHunk = false;

  for (const line of lines) {
    if (readMarkerValue(line, '---') !== undefined) {
      hasOldHeader = true;
    } else if (readMarkerValue(line, '+++') !== undefined) {
      hasNewHeader = true;
    } else if (line.startsWith('@@')) {
      hasHunk = true;
    }
  }

  return hasOldHeader && hasNewHeader && hasHunk;
}

function parseFileHeader(line: string, marker: '---' | '+++', optionalPrefix: 'a/' | 'b/'): string | undefined {
  const value = readMarkerValue(line, marker);
  if (value === undefined) {
    return undefined;
  }
  const withoutPrefix = value.startsWith(optionalPrefix) ? value.slice(optionalPrefix.length) : value;
  return stripPatchMeta(withoutPrefix);
}

function readMarkerValue(line: string, marker: '---' | '+++'): string | undefined {
  if (!line.startsWith(marker)) {
    return undefined;
  }
  const next = line[marker.length];
  if (next !== ' ' && next !== '\t') {
    return undefined;
  }
  return line.slice(marker.length + 1).trimStart();
}

function firstWhitespaceIndex(value: string): number {
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (char === ' ' || char === '\t' || char === '\r' || char === '\n') {
      return index;
    }
  }
  return -1;
}

function isValidHunkLinePrefix(char: string): boolean {
  return char === ' ' || char === '+' || char === '-' || char === '\\';
}

import path from 'node:path';
import { parseUnifiedDiff } from './patcher.js';
import { SafetyCheckResult } from './types.js';

export interface SafetyOptions {
  maxFiles?: number;
  allowLockfile?: boolean;
  allowWorkflowPermissions?: boolean;
}

const DEFAULT_MAX_FILES = 5;

const LOCKFILES = new Set([
  'package-lock.json',
  'npm-shrinkwrap.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'bun.lockb',
  'poetry.lock',
  'Pipfile.lock',
  'uv.lock'
]);

export function validatePatchSafety(patch: string, options: SafetyOptions = {}): SafetyCheckResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  let changedFiles: string[] = [];
  const forbiddenFiles: string[] = [];

  if (containsBinaryPatch(patch)) {
    errors.push('Binary file changes are not allowed.');
  }

  try {
    changedFiles = [
      ...new Set(parseUnifiedDiff(patch).map((file) => normalizePatchPath(file.newPath || file.oldPath)))
    ];
  } catch (error) {
    return {
      passed: false,
      errors: [...errors, error instanceof Error ? error.message : String(error)],
      warnings,
      changedFiles,
      forbiddenFiles
    };
  }

  const maxFiles = options.maxFiles ?? DEFAULT_MAX_FILES;
  if (changedFiles.length > maxFiles) {
    errors.push(`Patch touches too many files (${changedFiles.length} > ${maxFiles}).`);
  }

  for (const file of changedFiles) {
    if (isUnsafePath(file)) {
      errors.push(`Patch path escapes the repository: ${file}`);
    }

    if (isForbiddenFile(file)) {
      forbiddenFiles.push(file);
      errors.push(`Patch touches forbidden file: ${file}`);
    }

    if (!options.allowLockfile && LOCKFILES.has(path.posix.basename(file))) {
      errors.push(`Patch touches lockfile without --allow-lockfile: ${file}`);
    }

    if (
      !options.allowWorkflowPermissions &&
      file.startsWith('.github/workflows/') &&
      /^[+-]\s*permissions\s*:/m.test(patch)
    ) {
      errors.push('Patch changes GitHub workflow permissions without explicit allowance.');
    }
  }

  if (changedFiles.length === 0) {
    warnings.push('Patch did not report any changed files.');
  }

  return {
    passed: errors.length === 0,
    errors,
    warnings,
    changedFiles,
    forbiddenFiles
  };
}

function isForbiddenFile(file: string): boolean {
  const name = path.posix.basename(file).toLowerCase();
  return (
    name === '.env' ||
    name.startsWith('.env.') ||
    name.endsWith('.pem') ||
    name.endsWith('.key') ||
    name.endsWith('.p12') ||
    name.endsWith('.pfx') ||
    name === 'id_rsa' ||
    name === 'id_dsa' ||
    name.includes('secret') ||
    name.includes('private-key')
  );
}

function isUnsafePath(file: string): boolean {
  return file.startsWith('../') || file.includes('/../') || path.posix.isAbsolute(file);
}

function normalizePatchPath(file: string): string {
  return file.replace(/\\/g, '/').replace(/^a\//, '').replace(/^b\//, '');
}

function containsBinaryPatch(patch: string): boolean {
  for (const line of patch.split(/\r?\n/)) {
    const lower = line.toLowerCase();
    if (lower.includes('git binary patch')) {
      return true;
    }
    if (lower.startsWith('binary files ') && lower.endsWith(' differ')) {
      return true;
    }
  }
  return false;
}

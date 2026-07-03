import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { Diagnosis } from './types.js';
import { SnapshotFile } from './snapshot.js';

const CONFIG_FILES = ['package.json', 'pyproject.toml', 'requirements.txt', 'README.md'];

export async function buildRelevantContext(repoPath: string, diagnosis: Diagnosis): Promise<SnapshotFile[]> {
  const candidates = new Set<string>([
    ...CONFIG_FILES,
    ...diagnosis.likely_files,
    ...relatedTestFiles(diagnosis.likely_files)
  ]);
  const files: SnapshotFile[] = [];

  for (const candidate of candidates) {
    const safePath = normalizeSafeRelativePath(candidate);
    if (!safePath) {
      continue;
    }

    const fullPath = path.resolve(repoPath, safePath);
    if (!fullPath.startsWith(path.resolve(repoPath))) {
      continue;
    }

    if (await exists(fullPath)) {
      files.push({
        path: safePath,
        content: (await readFile(fullPath, 'utf8')).slice(0, 20_000)
      });
    }
  }

  return files;
}

export function renderContextFiles(files: SnapshotFile[]): string {
  return files.map((file) => `--- ${file.path} ---\n${file.content}`).join('\n\n');
}

function relatedTestFiles(files: string[]): string[] {
  const related = new Set<string>();
  for (const file of files) {
    if (file.endsWith('.js') || file.endsWith('.ts') || file.endsWith('.py')) {
      const ext = path.posix.extname(file);
      const base = file.slice(0, -ext.length);
      related.add(`${base}.test${ext}`);
      related.add(`${base}.spec${ext}`);
      related.add(`test${ext}`);
    }
  }

  return [...related];
}

function normalizeSafeRelativePath(file: string): string | undefined {
  const normalized = file.replace(/\\/g, '/').replace(/^\.?\//, '');
  if (normalized.startsWith('../') || normalized.includes('/../') || path.posix.isAbsolute(normalized)) {
    return undefined;
  }

  return normalized;
}

async function exists(file: string): Promise<boolean> {
  return access(file).then(
    () => true,
    () => false
  );
}

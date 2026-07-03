import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

export interface SnapshotFile {
  path: string;
  content: string;
}

export interface RepositorySnapshot {
  root: string;
  tree: string[];
  files: SnapshotFile[];
}

const IGNORED_DIRS = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  'coverage',
  '.next',
  '.venv',
  'venv',
  '__pycache__'
]);

const TEXT_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.json',
  '.py',
  '.md',
  '.yml',
  '.yaml',
  '.toml',
  '.txt'
]);

export async function collectRepositorySnapshot(
  repoPath: string,
  options: { maxFiles?: number; maxBytesPerFile?: number } = {}
): Promise<RepositorySnapshot> {
  const maxFiles = options.maxFiles ?? 80;
  const maxBytesPerFile = options.maxBytesPerFile ?? 12_000;
  const allFiles = await listFiles(repoPath);
  const selected = allFiles
    .filter((file) => TEXT_EXTENSIONS.has(path.extname(file).toLowerCase()) || importantFile(file))
    .slice(0, maxFiles);

  const files = await Promise.all(
    selected.map(async (file) => ({
      path: file,
      content: (await readFile(path.join(repoPath, file), 'utf8')).slice(0, maxBytesPerFile)
    }))
  );

  return {
    root: repoPath,
    tree: allFiles.slice(0, 300),
    files
  };
}

export async function collectFocusedFiles(repoPath: string, files: string[]): Promise<SnapshotFile[]> {
  const uniqueFiles = [...new Set(files.filter(Boolean))];
  const result: SnapshotFile[] = [];

  for (const file of uniqueFiles) {
    const target = path.resolve(repoPath, file);
    const relative = path.relative(path.resolve(repoPath), target);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      continue;
    }

    const content = await readFile(target, 'utf8').catch(() => undefined);
    if (content !== undefined) {
      result.push({ path: file.replace(/\\/g, '/'), content });
    }
  }

  return result;
}

async function listFiles(root: string, dir = ''): Promise<string[]> {
  const absoluteDir = path.join(root, dir);
  const entries = await readdir(absoluteDir, { withFileTypes: true });
  const result: string[] = [];

  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.isDirectory() && IGNORED_DIRS.has(entry.name)) {
      continue;
    }

    const relative = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      result.push(...(await listFiles(root, relative)));
    } else if (entry.isFile()) {
      const info = await stat(path.join(root, relative));
      if (info.size <= 500_000) {
        result.push(relative.replace(/\\/g, '/'));
      }
    }
  }

  return result;
}

function importantFile(file: string): boolean {
  return ['package.json', 'pyproject.toml', 'requirements.txt', 'README.md'].includes(path.basename(file));
}

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { simpleGit, SimpleGit } from 'simple-git';

export interface WorkspacePaths {
  root: string;
  reposDir: string;
  repoPath: string;
  statePath: string;
  analysisPath: string;
  fixPath: string;
}

export interface GitHubRepository {
  owner: string;
  repo: string;
}

export interface DevloopState {
  repoUrl: string;
  repoPath: string;
  slug: string;
  initializedAt: string;
  analysisPath?: string;
  fixPath?: string;
}

export interface InitResult {
  state: DevloopState;
  paths: WorkspacePaths;
}

export function repoSlugFromUrl(repoUrl: string): string {
  const remote = parseGitHubRemote(repoUrl);
  return `${remote.owner}__${remote.repo}`;
}

export function parseGitHubRemote(remoteUrl: string): GitHubRepository {
  const trimmed = remoteUrl.trim().replace(/\.git$/, '');

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    const url = new URL(trimmed);
    if (url.hostname.toLowerCase() === 'github.com') {
      const [owner, repo] = url.pathname.replace(/^\//, '').split('/');
      if (owner && repo) {
        return { owner, repo };
      }
    }
  }

  const sshMatch = trimmed.match(/^git@github\.com:([^/]+)\/([^/]+)$/i);
  if (sshMatch) {
    return { owner: sshMatch[1]!, repo: sshMatch[2]! };
  }

  throw new Error(`Unsupported GitHub remote URL: ${remoteUrl}`);
}

export function resolveWorkspacePaths(cwd: string, slug = 'repo'): WorkspacePaths {
  const normalizedCwd = slash(cwd);
  const root = joinSlash(normalizedCwd, '.devloop');
  const reposDir = joinSlash(root, 'repos');
  const repoPath = joinSlash(reposDir, slug);

  return {
    root,
    reposDir,
    repoPath,
    statePath: joinSlash(root, 'state.json'),
    analysisPath: joinSlash(root, 'analysis.json'),
    fixPath: joinSlash(root, 'fix.json')
  };
}

export async function initRepository(
  repoUrl: string,
  cwd = process.cwd(),
  gitFactory: (baseDir?: string) => SimpleGit = simpleGit
): Promise<InitResult> {
  const slug = repoSlugFromUrl(repoUrl);
  const paths = resolveWorkspacePaths(cwd, slug);

  await mkdir(paths.reposDir, { recursive: true });
  await gitFactory().clone(repoUrl, paths.repoPath);

  const state: DevloopState = {
    repoUrl,
    repoPath: paths.repoPath,
    slug,
    initializedAt: new Date().toISOString()
  };

  await saveState(paths.statePath, state);
  return { state, paths };
}

export async function loadState(cwd = process.cwd()): Promise<DevloopState> {
  const paths = resolveWorkspacePaths(cwd);
  const raw = await readFile(paths.statePath, 'utf8').catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') {
      throw new Error('No DevLoop repository initialized. Run devloop init <repo> first.');
    }

    throw error;
  });

  const state = JSON.parse(raw) as DevloopState;
  if (!state.repoPath || !state.repoUrl || !state.slug) {
    throw new Error('Invalid .devloop/state.json. Re-run devloop init <repo>.');
  }

  return state;
}

export async function saveState(statePath: string, state: DevloopState): Promise<void> {
  await mkdir(path.dirname(statePath), { recursive: true });
  await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
}

export function workspacePathsForState(cwd: string, state: DevloopState): WorkspacePaths {
  return resolveWorkspacePaths(cwd, state.slug);
}

function joinSlash(...parts: string[]): string {
  return slash(path.posix.join(...parts.map((part) => slash(part))));
}

function slash(value: string): string {
  return value.replace(/\\/g, '/');
}

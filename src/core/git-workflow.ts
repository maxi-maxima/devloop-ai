import { simpleGit, SimpleGit } from 'simple-git';
import { parseGitHubRemote } from './repository.js';
import { buildAuthenticatedRemoteUrl, createPullRequest } from '../github/pull-request.js';

export interface PrWorkflowOptions {
  repoPath: string;
  token: string;
  title: string;
  body: string;
  base?: string;
  branch?: string;
}

export interface PrWorkflowResult {
  branch: string;
  url: string;
  number: number;
}

export async function createPrFromLocalChanges(options: PrWorkflowOptions): Promise<PrWorkflowResult> {
  const git = simpleGit(options.repoPath);
  const status = await git.status();
  if (status.isClean()) {
    throw new Error('No local changes to commit. Run devloop fix first.');
  }

  const branch = options.branch ?? `devloop/ai-fix-${Date.now()}`;
  const remotes = await git.getRemotes(true);
  const origin = remotes.find((remote: { name: string; refs: { push: string } }) => remote.name === 'origin')
    ?.refs.push;
  if (!origin) {
    throw new Error('Repository does not have an origin remote.');
  }

  const repo = parseGitHubRemote(origin);
  const base = options.base ?? (await inferBaseBranch(git));

  await git.checkoutLocalBranch(branch);
  await git.add('.');
  await git.commit(options.title);
  await git.push(buildAuthenticatedRemoteUrl(origin, options.token), branch, ['--set-upstream']);

  const pr = await createPullRequest({
    token: options.token,
    owner: repo.owner,
    repo: repo.repo,
    title: options.title,
    head: branch,
    base,
    body: options.body
  });

  return { branch, ...pr };
}

async function inferBaseBranch(git: SimpleGit): Promise<string> {
  const symbolic = await git.raw(['symbolic-ref', '--short', 'refs/remotes/origin/HEAD']).catch(() => '');
  const fromOriginHead = symbolic.trim().replace(/^origin\//, '');
  if (fromOriginHead) {
    return fromOriginHead;
  }

  const branches = await git.branch(['-r']);
  if (branches.all.includes('origin/main')) {
    return 'main';
  }
  if (branches.all.includes('origin/master')) {
    return 'master';
  }

  return 'main';
}

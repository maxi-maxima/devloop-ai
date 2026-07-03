import { FetchLike } from '../github/pull-request.js';

export interface CreateBranchRefInput {
  owner: string;
  repo: string;
  branch: string;
  sha: string;
  token: string;
  fetchImpl?: FetchLike;
}

export async function createBranchRef(input: CreateBranchRefInput): Promise<void> {
  const response = await (input.fetchImpl ?? fetch)(
    `https://api.github.com/repos/${input.owner}/${input.repo}/git/refs`,
    {
      method: 'POST',
      headers: githubHeaders(input.token),
      body: JSON.stringify({
        ref: `refs/heads/${input.branch}`,
        sha: input.sha
      })
    }
  );
  if (!response.ok) {
    const payload = (await response.json()) as { message?: string };
    throw new Error(`GitHub branch creation failed: ${payload.message ?? response.statusText}`);
  }
}

function githubHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'devloop-ai'
  };
}

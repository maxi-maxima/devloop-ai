import { FetchLike } from '../github/pull-request.js';

export interface PostIssueCommentInput {
  owner: string;
  repo: string;
  issueNumber: number;
  token: string;
  body: string;
  fetchImpl?: FetchLike;
}

export async function postIssueComment(input: PostIssueCommentInput): Promise<{ id: number; url: string }> {
  const response = await (input.fetchImpl ?? fetch)(
    `https://api.github.com/repos/${input.owner}/${input.repo}/issues/${input.issueNumber}/comments`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${input.token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'devloop-ai'
      },
      body: JSON.stringify({ body: input.body })
    }
  );
  const payload = (await response.json()) as { id?: number; html_url?: string; message?: string };
  if (!response.ok || typeof payload.id !== 'number') {
    throw new Error(`GitHub issue comment failed: ${payload.message ?? response.statusText}`);
  }
  return { id: payload.id, url: payload.html_url ?? '' };
}

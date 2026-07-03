import { postIssueComment } from '../github-app/comments.js';

export function formatStatusComment(status: string, details?: string): string {
  return [`DevLoop AI: ${status}`, details ? `\n${details}` : ''].join('');
}

export async function postStatusComment(input: {
  owner: string;
  repo: string;
  issueNumber: number;
  token: string;
  status: string;
  details?: string;
}): Promise<{ id: number; url: string }> {
  return postIssueComment({
    owner: input.owner,
    repo: input.repo,
    issueNumber: input.issueNumber,
    token: input.token,
    body: formatStatusComment(input.status, input.details)
  });
}

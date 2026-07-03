import { FetchLike } from '../github/pull-request.js';

export async function fetchCollaboratorPermission(input: {
  owner: string;
  repo: string;
  username: string;
  token: string;
  fetchImpl?: FetchLike;
}): Promise<string> {
  const response = await (input.fetchImpl ?? fetch)(
    `https://api.github.com/repos/${input.owner}/${input.repo}/collaborators/${input.username}/permission`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${input.token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'devloop-ai'
      }
    }
  );
  const payload = (await response.json()) as { permission?: string; message?: string };
  if (!response.ok || !payload.permission) {
    throw new Error(`GitHub permission check failed: ${payload.message ?? response.statusText}`);
  }
  return payload.permission;
}

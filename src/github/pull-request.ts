export interface PullRequestInput {
  token: string;
  owner: string;
  repo: string;
  title: string;
  head: string;
  base: string;
  body: string;
}

export interface PullRequestResult {
  url: string;
  number: number;
}

export type FetchLike = (
  input: string,
  init?: RequestInit
) => Promise<{
  ok: boolean;
  statusText?: string;
  json: () => Promise<unknown>;
}>;

export function buildAuthenticatedRemoteUrl(remoteUrl: string, token: string): string {
  if (!remoteUrl.startsWith('https://github.com/')) {
    return remoteUrl;
  }

  const url = new URL(remoteUrl);
  url.username = 'x-access-token';
  url.password = token;
  return url.toString();
}

export async function createPullRequest(
  input: PullRequestInput,
  fetchImpl: FetchLike = fetch
): Promise<PullRequestResult> {
  const response = await fetchImpl(
    `https://api.github.com/repos/${input.owner}/${input.repo}/pulls`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${input.token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'devloop-ai'
      },
      body: JSON.stringify({
        title: input.title,
        head: input.head,
        base: input.base,
        body: input.body
      })
    }
  );

  const payload = (await response.json()) as { html_url?: string; number?: number; message?: string };
  if (!response.ok) {
    throw new Error(`GitHub PR creation failed: ${payload.message ?? response.statusText}`);
  }

  if (!payload.html_url || typeof payload.number !== 'number') {
    throw new Error('GitHub PR creation response did not include html_url and number.');
  }

  return { url: payload.html_url, number: payload.number };
}

export type HeaderLike = { get(name: string): string | null };

export type WorkflowFetchLike = (
  input: string,
  init?: RequestInit
) => Promise<{
  ok: boolean;
  status: number;
  statusText?: string;
  headers?: HeaderLike;
  text: () => Promise<string>;
}>;

export interface FetchWorkflowRunLogsInput {
  owner: string;
  repo: string;
  runId: number;
  token: string;
  fetchImpl?: WorkflowFetchLike;
}

export async function fetchWorkflowRunLogs(input: FetchWorkflowRunLogsInput): Promise<string> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const response = await fetchImpl(
    `https://api.github.com/repos/${input.owner}/${input.repo}/actions/runs/${input.runId}/logs`,
    {
      method: 'GET',
      redirect: 'manual',
      headers: githubHeaders(input.token)
    }
  );

  if (response.status === 302) {
    const location = response.headers?.get('location');
    if (!location) {
      throw new Error('GitHub workflow log response did not include a redirect location.');
    }
    const archive = await fetchImpl(location, { method: 'GET' });
    if (!archive.ok) {
      throw new Error(`GitHub workflow log archive download failed: ${archive.statusText ?? archive.status}`);
    }
    return archive.text();
  }

  if (!response.ok) {
    throw new Error(`GitHub workflow log request failed: ${response.statusText ?? response.status}`);
  }

  return response.text();
}

export interface FetchWorkflowRunMetadataInput {
  owner: string;
  repo: string;
  runId: number;
  token: string;
  fetchImpl?: typeof fetch;
}

export async function fetchWorkflowRunMetadata(input: FetchWorkflowRunMetadataInput): Promise<unknown> {
  const response = await (input.fetchImpl ?? fetch)(
    `https://api.github.com/repos/${input.owner}/${input.repo}/actions/runs/${input.runId}`,
    {
      method: 'GET',
      headers: githubHeaders(input.token)
    }
  );
  const payload = await response.json();
  if (!response.ok) {
    const message = typeof payload === 'object' && payload && 'message' in payload ? String(payload.message) : '';
    throw new Error(`GitHub workflow run metadata request failed: ${message || response.statusText}`);
  }
  return payload;
}

function githubHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'devloop-ai'
  };
}

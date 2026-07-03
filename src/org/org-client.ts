import type { PullRequestResult } from '../github/pull-request.js';
import type { OrgJobSummary, OrgRepository } from './types.js';

export interface OrgPullRequestInput {
  repo: string;
  title: string;
  branch: string;
  base: string;
  body: string;
  files: Record<string, string>;
}

export interface OrgGitHubClient {
  listInstalledRepositories(): Promise<OrgRepository[]>;
  listRepositoryFiles(repo: string): Promise<string[]>;
  getFile(repo: string, filePath: string): Promise<string | undefined>;
  listRecentDevLoopJobs(repo: string): Promise<OrgJobSummary[]>;
  createPullRequest(input: OrgPullRequestInput): Promise<PullRequestResult>;
}

export interface GitHubOrgClientOptions {
  organization: string;
  token: string;
  fetchImpl?: typeof fetch;
}

export class GitHubOrgClient implements OrgGitHubClient {
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: GitHubOrgClientOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async listInstalledRepositories(): Promise<OrgRepository[]> {
    const repos = await this.request<Array<Record<string, unknown>>>(
      `https://api.github.com/orgs/${this.options.organization}/repos?per_page=100&type=all`
    );
    return repos.map((repo) => ({
      name: stringValue(repo.name),
      fullName: stringValue(repo.full_name),
      defaultBranch: stringValue(repo.default_branch) || 'main',
      archived: Boolean(repo.archived),
      private: Boolean(repo.private)
    }));
  }

  async listRepositoryFiles(repo: string): Promise<string[]> {
    const tree = await this.request<{ tree?: Array<{ path?: string; type?: string }> }>(
      `https://api.github.com/repos/${this.options.organization}/${repo}/git/trees/HEAD?recursive=1`
    );
    return (tree.tree ?? []).filter((item) => item.type === 'blob' && item.path).map((item) => item.path!);
  }

  async getFile(repo: string, filePath: string): Promise<string | undefined> {
    const response = await this.fetchImpl(
      `https://api.github.com/repos/${this.options.organization}/${repo}/contents/${encodeURIComponentPath(filePath)}`,
      { headers: this.headers() }
    );
    if (response.status === 404) {
      return undefined;
    }
    if (!response.ok) {
      throw new Error(`GitHub content request failed for ${repo}/${filePath}: ${response.statusText}`);
    }
    const payload = (await response.json()) as { content?: string; encoding?: string };
    if (!payload.content) {
      return undefined;
    }
    return payload.encoding === 'base64'
      ? Buffer.from(payload.content.replace(/\s/g, ''), 'base64').toString('utf8')
      : payload.content;
  }

  async listRecentDevLoopJobs(_repo: string): Promise<OrgJobSummary[]> {
    return [];
  }

  async createPullRequest(input: OrgPullRequestInput): Promise<PullRequestResult> {
    if (Object.keys(input.files).length > 0) {
      await this.createBranchWithFiles(input);
    }

    const response = await this.fetchImpl(
      `https://api.github.com/repos/${this.options.organization}/${input.repo}/pulls`,
      {
        method: 'POST',
        headers: {
          ...this.headers(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: input.title,
          head: input.branch,
          base: input.base,
          body: input.body
        })
      }
    );
    const payload = (await response.json()) as { html_url?: string; number?: number; message?: string };
    if (!response.ok || !payload.html_url || typeof payload.number !== 'number') {
      throw new Error(`GitHub PR creation failed: ${payload.message ?? response.statusText}`);
    }
    return { url: payload.html_url, number: payload.number };
  }

  private async createBranchWithFiles(input: OrgPullRequestInput): Promise<void> {
    const baseRef = await this.request<{ object?: { sha?: string } }>(
      `https://api.github.com/repos/${this.options.organization}/${input.repo}/git/ref/heads/${encodeURIComponentPath(
        input.base
      )}`
    );
    const baseSha = baseRef.object?.sha;
    if (!baseSha) {
      throw new Error(`GitHub base branch lookup failed for ${input.repo}:${input.base}`);
    }

    await this.createBranch(input.repo, input.branch, baseSha);
    for (const [filePath, content] of Object.entries(input.files)) {
      await this.putFile(input.repo, input.branch, filePath, content, input.title);
    }
  }

  private async createBranch(repo: string, branch: string, baseSha: string): Promise<void> {
    const response = await this.fetchImpl(`https://api.github.com/repos/${this.options.organization}/${repo}/git/refs`, {
      method: 'POST',
      headers: {
        ...this.headers(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ref: `refs/heads/${branch}`,
        sha: baseSha
      })
    });
    if (!response.ok && response.status !== 422) {
      const payload = (await response.json().catch(() => ({}))) as { message?: string };
      throw new Error(`GitHub branch creation failed: ${payload.message ?? response.statusText}`);
    }
  }

  private async putFile(repo: string, branch: string, filePath: string, content: string, message: string): Promise<void> {
    const existing = await this.getContentMetadata(repo, filePath, branch);
    const response = await this.fetchImpl(
      `https://api.github.com/repos/${this.options.organization}/${repo}/contents/${encodeURIComponentPath(filePath)}`,
      {
        method: 'PUT',
        headers: {
          ...this.headers(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message,
          content: Buffer.from(content, 'utf8').toString('base64'),
          branch,
          ...(existing?.sha ? { sha: existing.sha } : {})
        })
      }
    );
    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { message?: string };
      throw new Error(`GitHub file update failed for ${repo}/${filePath}: ${payload.message ?? response.statusText}`);
    }
  }

  private async getContentMetadata(
    repo: string,
    filePath: string,
    branch: string
  ): Promise<{ sha?: string } | undefined> {
    const response = await this.fetchImpl(
      `https://api.github.com/repos/${this.options.organization}/${repo}/contents/${encodeURIComponentPath(
        filePath
      )}?ref=${encodeURIComponent(branch)}`,
      { headers: this.headers() }
    );
    if (response.status === 404) {
      return undefined;
    }
    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { message?: string };
      throw new Error(`GitHub content metadata request failed: ${payload.message ?? response.statusText}`);
    }
    return (await response.json()) as { sha?: string };
  }

  private async request<T>(url: string): Promise<T> {
    const response = await this.fetchImpl(url, { headers: this.headers() });
    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { message?: string };
      throw new Error(`GitHub org request failed: ${payload.message ?? response.statusText}`);
    }
    return (await response.json()) as T;
  }

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.options.token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'devloop-ai'
    };
  }
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function encodeURIComponentPath(filePath: string): string {
  return filePath.split('/').map(encodeURIComponent).join('/');
}

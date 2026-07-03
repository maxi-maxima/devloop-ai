import { FetchLike } from '../github/pull-request.js';

export interface InstallationToken {
  token: string;
  expiresAt: Date;
}

export interface InstallationTokenCacheOptions {
  createJwt: () => string;
  fetchImpl?: FetchLike;
  now?: () => Date;
}

export class InstallationTokenCache {
  private readonly cache = new Map<number, InstallationToken>();
  private readonly fetchImpl: FetchLike;
  private readonly now: () => Date;

  constructor(private readonly options: InstallationTokenCacheOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.now = options.now ?? (() => new Date());
  }

  async getToken(installationId: number): Promise<InstallationToken> {
    const cached = this.cache.get(installationId);
    if (cached && cached.expiresAt.getTime() - this.now().getTime() > 5 * 60 * 1000) {
      return cached;
    }

    const response = await this.fetchImpl(
      `https://api.github.com/app/installations/${installationId}/access_tokens`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.options.createJwt()}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'devloop-ai'
        }
      }
    );
    const payload = (await response.json()) as { token?: string; expires_at?: string; message?: string };
    if (!response.ok || !payload.token || !payload.expires_at) {
      throw new Error(`GitHub installation token request failed: ${payload.message ?? response.statusText}`);
    }

    const token = {
      token: payload.token,
      expiresAt: new Date(payload.expires_at)
    };
    this.cache.set(installationId, token);
    return token;
  }
}

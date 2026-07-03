import type { OrgGitHubClient } from './org-client.js';
import type { DevLoopOrgConfig, OrgRepository } from './types.js';

export async function discoverOrgRepositories(
  client: OrgGitHubClient,
  config: Pick<DevLoopOrgConfig, 'organization' | 'repositories'>
): Promise<OrgRepository[]> {
  const repos = await client.listInstalledRepositories();
  return repos
    .filter((repo) => !repo.archived)
    .filter((repo) => matchesAny(repo.name, config.repositories.include.length ? config.repositories.include : ['*']))
    .filter((repo) => !matchesAny(repo.name, config.repositories.exclude));
}

function matchesAny(value: string, patterns: string[]): boolean {
  return patterns.some((pattern) => globMatch(value, pattern));
}

function globMatch(value: string, pattern: string): boolean {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`).test(value);
}

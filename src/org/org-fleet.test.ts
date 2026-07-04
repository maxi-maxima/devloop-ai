import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import { discoverOrgRepositories } from './repo-discovery.js';
import { scanOrganization } from './repo-analyzer.js';
import { createRolloutPlan } from './rollout-planner.js';
import { createPolicySyncPlan } from './policy-sync.js';
import { renderOrgReport, writeOrgReport } from './org-report.js';
import { parseOrgConfig } from './config.js';
import { GitHubOrgClient, type OrgGitHubClient } from './org-client.js';

const tempDirs: string[] = [];

describe('org fleet mode', () => {
  afterEach(async () => {
    await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
    tempDirs.length = 0;
  });

  test('discovers installed repositories with include and exclude patterns', async () => {
    const repos = await discoverOrgRepositories(mockClient(), {
      organization: 'acme',
      repositories: {
        include: ['*'],
        exclude: ['legacy-*', 'archived-*']
      }
    });

    expect(repos.map((repo) => repo.name)).toEqual(['api-service', 'web-app']);
  });

  test('parses devloop-org.yml configuration', () => {
    const config = parseOrgConfig(`
organization: acme
defaults:
  mode: pr
  maxRetries: 4
  allowNetwork: false
  firewallMode: strict
repositories:
  include:
    - "*"
    - "api-*"
  exclude:
    - "legacy-*"
`);

    expect(config.organization).toBe('acme');
    expect(config.defaults).toMatchObject({ mode: 'pr', maxRetries: 4, allowNetwork: false, firewallMode: 'strict' });
    expect(config.repositories.include).toEqual(['*', 'api-*']);
    expect(config.repositories.exclude).toEqual(['legacy-*']);
  });

  test('parses org config with adversarial spacing and comments without regex backtracking', () => {
    const padding = ' '.repeat(6000);
    const config = parseOrgConfig(`
${'#'.repeat(6000)}
organization:${padding}acme
defaults:
  mode:${padding}dry-run
  maxRetries:${padding}3
  allowNetwork:${padding}false
  firewallMode:${padding}strict
repositories:
  include:
    -${padding}"api-*"
  exclude:
    -${padding}"legacy-*"
`);

    expect(config.organization).toBe('acme');
    expect(config.defaults.maxRetries).toBe(3);
    expect(config.repositories.include).toEqual(['api-*']);
    expect(config.repositories.exclude).toEqual(['legacy-*']);
  });

  test('scans repositories for language, CI, test command, scanners, and DevLoop configs', async () => {
    const report = await scanOrganization({
      client: mockClient(),
      config: {
        organization: 'acme',
        defaults: {
          mode: 'dry-run',
          maxRetries: 2,
          allowNetwork: false,
          firewallMode: 'strict'
        },
        repositories: {
          include: ['*'],
          exclude: ['legacy-*', 'archived-*']
        }
      }
    });

    expect(report.repositories).toHaveLength(2);
    expect(report.repositories[0]).toMatchObject({
      repo: 'api-service',
      language: 'TypeScript',
      ci: true,
      testCommand: 'npm test',
      devloopConfig: true,
      firewallPolicy: true
    });
    expect(report.summary.reposEnabled).toBe(1);
    expect(report.summary.reposDryRun).toBe(1);
  });

  test('generates rollout PR plans without enabling PR mode by default', async () => {
    const scan = await scanOrganization({ client: mockClient(), config: basicConfig('pr') });
    const plan = createRolloutPlan(scan, basicConfig('pr'), {
      confirmPrMode: false,
      includeGitHubAction: true
    });

    const web = plan.repositories.find((repo) => repo.repo === 'web-app');
    expect(web?.action).toBe('create-pr');
    expect(web?.files['.devloop.yml']).toContain('mode: dry-run');
    expect(web?.files['.devloop-policy.yml']).toContain('mode: strict');
    expect(web?.files['.github/workflows/devloop-autofix.yml']).toContain('devloop autofix');
    expect(web?.warnings).toContain('PR mode was not enabled because --confirm-pr-mode was not passed.');
  });

  test('requires explicit confirmation before org-wide PR mode rollout', async () => {
    const scan = await scanOrganization({ client: mockClient(), config: basicConfig('pr') });
    const safePlan = createRolloutPlan(scan, basicConfig('pr'), { confirmPrMode: false });
    const confirmedPlan = createRolloutPlan(scan, basicConfig('pr'), { confirmPrMode: true });
    const safeWeb = safePlan.repositories.find((repo) => repo.repo === 'web-app');
    const confirmedWeb = confirmedPlan.repositories.find((repo) => repo.repo === 'web-app');

    expect(safeWeb?.files['.devloop.yml']).toContain('mode: dry-run');
    expect(confirmedWeb?.files['.devloop.yml']).toContain('mode: pr');
  });

  test('creates policy sync diffs in dry-run mode', async () => {
    const scan = await scanOrganization({ client: mockClient(), config: basicConfig() });
    const plan = createPolicySyncPlan(scan, {
      firewallMode: 'strict',
      allowNetwork: false,
      dryRun: true
    });

    expect(plan.dryRun).toBe(true);
    expect(plan.repositories.some((repo) => repo.repo === 'web-app' && repo.changed)).toBe(true);
    expect(plan.repositories.find((repo) => repo.repo === 'web-app')?.diff).toContain('+firewall:');
  });

  test('renders and writes the organization report table', async () => {
    const outputDir = await tempDir();
    const scan = await scanOrganization({ client: mockClient(), config: basicConfig() });
    const markdown = renderOrgReport(scan);
    const outputPath = path.join(outputDir, 'devloop-org-report.md');
    await writeOrgReport(scan, outputPath);

    expect(markdown).toContain('| Repo | Language | CI | Test Command | DevLoop Config | Firewall | Last Status |');
    expect(markdown).toContain('api-service');
    await expect(stat(outputPath)).resolves.toBeTruthy();
    await expect(readFile(outputPath, 'utf8')).resolves.toContain('web-app');
  });

  test('creates GitHub rollout pull requests with planned config files', async () => {
    const requests: Array<{ url: string; method: string; body?: unknown }> = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      requests.push({ url, method, body });

      if (url.endsWith('/git/ref/heads/main')) {
        return jsonResponse(200, { object: { sha: 'base-sha' } });
      }
      if (url.endsWith('/git/refs')) {
        return jsonResponse(201, {});
      }
      if (url.includes('/contents/.devloop.yml?ref=')) {
        return jsonResponse(404, {});
      }
      if (url.includes('/contents/.devloop.yml') && method === 'PUT') {
        return jsonResponse(200, {});
      }
      if (url.endsWith('/pulls')) {
        return jsonResponse(201, { html_url: 'https://github.com/acme/web-app/pull/7', number: 7 });
      }
      return jsonResponse(500, { message: `Unexpected request ${method} ${url}` });
    };
    const client = new GitHubOrgClient({ organization: 'acme', token: 'token', fetchImpl });

    const pr = await client.createPullRequest({
      repo: 'web-app',
      title: 'chore: enable DevLoop AI',
      branch: 'devloop/org-rollout',
      base: 'main',
      body: 'Enable DevLoop',
      files: {
        '.devloop.yml': 'autofix:\n  enabled: true\n'
      }
    });

    const putRequest = requests.find((request) => request.method === 'PUT');
    expect(pr).toEqual({ url: 'https://github.com/acme/web-app/pull/7', number: 7 });
    expect(requests.map((request) => request.method)).toEqual(['GET', 'POST', 'GET', 'PUT', 'POST']);
    expect(putRequest?.body).toMatchObject({
      branch: 'devloop/org-rollout',
      content: Buffer.from('autofix:\n  enabled: true\n', 'utf8').toString('base64')
    });
  });
});

function basicConfig(mode: 'dry-run' | 'pr' = 'dry-run') {
  return {
    organization: 'acme',
    defaults: {
      mode,
      maxRetries: 2,
      allowNetwork: false,
      firewallMode: 'strict'
    },
    repositories: {
      include: ['*'],
      exclude: ['legacy-*', 'archived-*']
    }
  } as const;
}

function mockClient(): OrgGitHubClient {
  const files: Record<string, Record<string, string | undefined>> = {
    'api-service': {
      'package.json': JSON.stringify({ scripts: { test: 'npm test' }, devDependencies: { typescript: '^5.0.0' } }),
      '.github/workflows/ci.yml': 'name: CI\njobs:\n  test:\n    steps:\n      - run: npm test\n',
      '.devloop.yml': 'autofix:\n  enabled: true\n  mode: dry-run\n',
      '.devloop-policy.yml': 'firewall:\n  mode: strict\n',
      'codeql.yml': 'name: codeql'
    },
    'web-app': {
      'package.json': JSON.stringify({ scripts: { test: 'vitest run' }, dependencies: { react: '^18.0.0' } }),
      '.github/workflows/test.yml': 'name: test\njobs:\n  test:\n    steps:\n      - run: vitest run\n'
    },
    'legacy-api': {
      'package.json': JSON.stringify({ scripts: { test: 'pytest' } })
    },
    'archived-worker': {
      'pyproject.toml': '[tool.pytest.ini_options]\n'
    }
  };

  return {
    async listInstalledRepositories() {
      return [
        { name: 'api-service', fullName: 'acme/api-service', defaultBranch: 'main', archived: false, private: false },
        { name: 'web-app', fullName: 'acme/web-app', defaultBranch: 'main', archived: false, private: false },
        { name: 'legacy-api', fullName: 'acme/legacy-api', defaultBranch: 'main', archived: false, private: false },
        { name: 'archived-worker', fullName: 'acme/archived-worker', defaultBranch: 'main', archived: true, private: false }
      ];
    },
    async listRepositoryFiles(repo) {
      return Object.keys(files[repo] ?? {});
    },
    async getFile(repo, filePath) {
      return files[repo]?.[filePath];
    },
    async listRecentDevLoopJobs(repo) {
      return repo === 'api-service'
        ? [{ status: 'succeeded', type: 'ci-autofix' }]
        : [{ status: 'blocked', type: 'firewall' }, { status: 'succeeded', type: 'security-autofix' }];
    },
    async createPullRequest(input) {
      return { url: `https://github.com/acme/${input.repo}/pull/1`, number: 1 };
    }
  };
}

async function tempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'devloop-org-'));
  tempDirs.push(dir);
  return dir;
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json'
    }
  });
}

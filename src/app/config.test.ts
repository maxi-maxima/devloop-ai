import { describe, expect, test } from 'vitest';
import { loadAppConfigFromEnv, parseRepositoryPolicy } from './config.js';

describe('GitHub App configuration', () => {
  test('loads required GitHub App env without leaking secrets', () => {
    const marker = 'PRIVATE KEY';
    const privateKey = `-----BEGIN ${marker}-----\\nabc\\n-----END ${marker}-----`;
    const config = loadAppConfigFromEnv({
      GITHUB_APP_ID: '123',
      GITHUB_APP_PRIVATE_KEY: privateKey,
      GITHUB_WEBHOOK_SECRET: 'webhook-secret',
      DEVLOOP_APP_BASE_URL: 'https://devloop.example.com',
      DEVLOOP_APP_PORT: '9999'
    });

    expect(config.appId).toBe('123');
    expect(config.privateKey).toContain('\nabc\n');
    expect(config.webhookSecret).toBe('webhook-secret');
    expect(config.port).toBe(9999);
    expect(JSON.stringify(config)).not.toContain('webhook-secret');
  });

  test('parses .devloop.yml and defaults missing config to dry-run mode', () => {
    const policy = parseRepositoryPolicy(`
enabled: true
autofix:
  enabled: true
  mode: "pr"
  maxRetries: 2
  testCommand: "npm test"
  installCommand: "npm install"
  allowedBranches:
    - main
    - release
  ignoredWorkflows:
    - release.yml
  maxFilesChanged: 4
  allowLockfileEdits: true
  allowNetwork: false
comments:
  enabled: true
  allowedUsers:
    - octocat
  commands:
    - diagnose
    - fix
`);

    expect(policy.autofix.mode).toBe('pr');
    expect(policy.autofix.maxRetries).toBe(2);
    expect(policy.autofix.allowedBranches).toEqual(['main', 'release']);
    expect(policy.comments.allowedUsers).toEqual(['octocat']);

    const defaults = parseRepositoryPolicy('');
    expect(defaults.autofix.mode).toBe('dry-run');
    expect(defaults.autofix.enabled).toBe(true);
    expect(defaults.comments.commands).toContain('dry-run');
  });
});

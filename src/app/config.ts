import path from 'node:path';
import { readTextFile } from '../utils/text-file.js';

export interface GitHubAppConfig {
  appId: string;
  privateKey: string;
  webhookSecret: string;
  clientId?: string;
  clientSecret?: string;
  baseUrl?: string;
  port: number;
  databasePath: string;
  allowLocalRunner: boolean;
  allowNetwork: boolean;
  toJSON(): Record<string, unknown>;
}

export interface RepositoryPolicy {
  enabled: boolean;
  autofix: {
    enabled: boolean;
    mode: 'dry-run' | 'pr';
    maxRetries: number;
    testCommand?: string;
    installCommand?: string;
    allowedBranches: string[];
    ignoredWorkflows: string[];
    maxFilesChanged: number;
    allowLockfileEdits: boolean;
    allowNetwork: boolean;
  };
  security: {
    enabled: boolean;
    sarifPaths: string[];
  };
  comments: {
    enabled: boolean;
    allowedUsers: string[];
    commands: string[];
  };
}

export function loadAppConfigFromEnv(env: NodeJS.ProcessEnv = process.env): GitHubAppConfig {
  const appId = requiredEnv(env, 'GITHUB_APP_ID');
  const privateKey = normalizePrivateKey(requiredEnv(env, 'GITHUB_APP_PRIVATE_KEY'));
  const webhookSecret = requiredEnv(env, 'GITHUB_WEBHOOK_SECRET');
  const port = parsePositiveInteger(env.DEVLOOP_APP_PORT ?? env.PORT ?? '8787', 'DEVLOOP_APP_PORT');
  const databasePath = path.resolve(env.DEVLOOP_APP_DB ?? '.devloop/devloop-app.sqlite');

  return {
    appId,
    privateKey,
    webhookSecret,
    clientId: env.GITHUB_APP_CLIENT_ID,
    clientSecret: env.GITHUB_APP_CLIENT_SECRET,
    baseUrl: env.DEVLOOP_APP_BASE_URL,
    port,
    databasePath,
    allowLocalRunner: env.DEVLOOP_ALLOW_LOCAL_RUNNER === 'true',
    allowNetwork: env.DEVLOOP_ALLOW_NETWORK === 'true',
    toJSON() {
      return {
        appId,
        privateKey: '[redacted]',
        webhookSecret: '[redacted]',
        clientId: env.GITHUB_APP_CLIENT_ID ? '[set]' : undefined,
        clientSecret: env.GITHUB_APP_CLIENT_SECRET ? '[redacted]' : undefined,
        baseUrl: env.DEVLOOP_APP_BASE_URL,
        port,
        databasePath,
        allowLocalRunner: env.DEVLOOP_ALLOW_LOCAL_RUNNER === 'true',
        allowNetwork: env.DEVLOOP_ALLOW_NETWORK === 'true'
      };
    }
  };
}

export async function loadRepositoryPolicy(repoPath: string): Promise<RepositoryPolicy> {
  const configPath = path.join(repoPath, '.devloop.yml');
  const content = await readTextFile(configPath).catch(() => '');
  return parseRepositoryPolicy(content);
}

export function parseRepositoryPolicy(content: string): RepositoryPolicy {
  const values = parseSimpleYaml(content);
  const defaults = defaultRepositoryPolicy();

  return {
    enabled: booleanValue(values.enabled, defaults.enabled),
    autofix: {
      enabled: booleanValue(values['autofix.enabled'], defaults.autofix.enabled),
      mode: enumValue(values['autofix.mode'], ['dry-run', 'pr'], defaults.autofix.mode),
      maxRetries: numberValue(values['autofix.maxRetries'], defaults.autofix.maxRetries),
      testCommand: stringValue(values['autofix.testCommand'], defaults.autofix.testCommand),
      installCommand: stringValue(values['autofix.installCommand'], defaults.autofix.installCommand),
      allowedBranches: arrayValue(values['autofix.allowedBranches'], defaults.autofix.allowedBranches),
      ignoredWorkflows: arrayValue(values['autofix.ignoredWorkflows'], defaults.autofix.ignoredWorkflows),
      maxFilesChanged: numberValue(values['autofix.maxFilesChanged'], defaults.autofix.maxFilesChanged),
      allowLockfileEdits: booleanValue(
        values['autofix.allowLockfileEdits'],
        defaults.autofix.allowLockfileEdits
      ),
      allowNetwork: booleanValue(values['autofix.allowNetwork'], defaults.autofix.allowNetwork)
    },
    security: {
      enabled: booleanValue(values['security.enabled'], defaults.security.enabled),
      sarifPaths: arrayValue(values['security.sarifPaths'], defaults.security.sarifPaths)
    },
    comments: {
      enabled: booleanValue(values['comments.enabled'], defaults.comments.enabled),
      allowedUsers: arrayValue(values['comments.allowedUsers'], defaults.comments.allowedUsers),
      commands: arrayValue(values['comments.commands'], defaults.comments.commands)
    }
  };
}

export function defaultRepositoryPolicy(): RepositoryPolicy {
  return {
    enabled: true,
    autofix: {
      enabled: true,
      mode: 'dry-run',
      maxRetries: 3,
      testCommand: undefined,
      installCommand: undefined,
      allowedBranches: ['main', 'master'],
      ignoredWorkflows: [],
      maxFilesChanged: 5,
      allowLockfileEdits: false,
      allowNetwork: false
    },
    security: {
      enabled: true,
      sarifPaths: ['results.sarif']
    },
    comments: {
      enabled: true,
      allowedUsers: ['maintainers'],
      commands: ['help', 'diagnose', 'fix', 'dry-run', 'security-fix', 'rerun']
    }
  };
}

function parseSimpleYaml(content: string): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  const sectionStack: { indent: number; key: string }[] = [];
  let pendingArrayKey: string | undefined;

  for (const rawLine of content.split(/\r?\n/)) {
    const withoutComment = rawLine.replace(/\s+#.*$/, '');
    if (!withoutComment.trim()) {
      continue;
    }

    const indent = withoutComment.match(/^\s*/)?.[0].length ?? 0;
    const trimmed = withoutComment.trim();

    while (sectionStack.length > 0 && indent <= sectionStack[sectionStack.length - 1]!.indent) {
      sectionStack.pop();
    }

    if (trimmed.startsWith('- ')) {
      if (pendingArrayKey) {
        const existing = values[pendingArrayKey];
        values[pendingArrayKey] = [...(Array.isArray(existing) ? existing : []), parseScalar(trimmed.slice(2))];
      }
      continue;
    }

    const match = trimmed.match(/^([A-Za-z][A-Za-z0-9_-]*):(?:\s*(.*))?$/);
    if (!match) {
      continue;
    }

    const key = match[1]!;
    const value = match[2] ?? '';
    const fullKey = [...sectionStack.map((item) => item.key), key].join('.');

    if (value === '') {
      sectionStack.push({ indent, key });
      pendingArrayKey = fullKey;
      values[fullKey] = values[fullKey] ?? [];
      continue;
    }

    values[fullKey] = parseScalar(value);
    pendingArrayKey = undefined;
  }

  return values;
}

function parseScalar(value: string): unknown {
  const trimmed = value.trim().replace(/^['"]|['"]$/g, '');
  if (trimmed === 'true') {
    return true;
  }
  if (trimmed === 'false') {
    return false;
  }
  if (/^-?\d+$/.test(trimmed)) {
    return Number.parseInt(trimmed, 10);
  }
  return trimmed;
}

function requiredEnv(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name];
  if (!value) {
    throw new Error(`${name} is required for DevLoop GitHub App mode.`);
  }
  return value;
}

function normalizePrivateKey(value: string): string {
  return value.replace(/\\n/g, '\n');
}

function parsePositiveInteger(value: string, name: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return parsed;
}

function booleanValue(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function numberValue(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function stringValue(value: unknown, fallback?: string): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

function arrayValue(value: unknown, fallback: string[]): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : fallback;
}

function enumValue<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && allowed.includes(value as T) ? (value as T) : fallback;
}

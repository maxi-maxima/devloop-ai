import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { DevLoopOrgConfig, OrgDefaultMode, OrgFirewallMode } from './types.js';

export async function loadOrgConfig(configPath = 'devloop-org.yml'): Promise<DevLoopOrgConfig> {
  return parseOrgConfig(await readFile(path.resolve(configPath), 'utf8'));
}

export function parseOrgConfig(text: string): DevLoopOrgConfig {
  const config: DevLoopOrgConfig = {
    organization: '',
    defaults: {
      mode: 'dry-run',
      maxRetries: 2,
      allowNetwork: false,
      firewallMode: 'strict'
    },
    repositories: {
      include: ['*'],
      exclude: []
    }
  };

  let section = '';
  let listTarget: 'include' | 'exclude' | undefined;
  for (const raw of text.split(/\r?\n/)) {
    const line = stripComment(raw);
    if (!line.trim()) {
      continue;
    }
    const topEntry = parseTopLevelEntry(line);
    if (topEntry?.type === 'pair') {
      if (topEntry.key === 'organization') {
        config.organization = strip(topEntry.value);
      }
      continue;
    }
    if (topEntry?.type === 'section') {
      section = topEntry.key;
      listTarget = undefined;
      continue;
    }
    if (section === 'defaults') {
      const pair = parseIndentedPair(line);
      if (pair) {
        assignDefault(config, pair.key, pair.value);
      }
    }
    if (section === 'repositories') {
      const nested = parseRepositoryListTarget(line);
      if (nested) {
        listTarget = nested;
        config.repositories[listTarget] = [];
        continue;
      }
      const item = parseListItem(line);
      if (item && listTarget) {
        config.repositories[listTarget].push(strip(item));
      }
    }
  }

  if (!config.organization) {
    throw new Error('devloop-org.yml requires organization.');
  }
  return config;
}

function assignDefault(config: DevLoopOrgConfig, key: string, value: string): void {
  if (key === 'mode') config.defaults.mode = strip(value) as OrgDefaultMode;
  if (key === 'maxRetries') config.defaults.maxRetries = Number.parseInt(value, 10);
  if (key === 'allowNetwork') config.defaults.allowNetwork = strip(value) === 'true';
  if (key === 'firewallMode') config.defaults.firewallMode = strip(value) as OrgFirewallMode;
}

function strip(value: string): string {
  let trimmed = value.trim();
  if (trimmed.startsWith('"') || trimmed.startsWith("'")) {
    trimmed = trimmed.slice(1);
  }
  if (trimmed.endsWith('"') || trimmed.endsWith("'")) {
    trimmed = trimmed.slice(0, -1);
  }
  return trimmed;
}

function stripComment(line: string): string {
  const commentStart = line.indexOf('#');
  return commentStart === -1 ? line : line.slice(0, commentStart);
}

function parseTopLevelEntry(line: string): { type: 'pair' | 'section'; key: string; value: string } | undefined {
  if (line.startsWith(' ')) {
    return undefined;
  }
  const entry = parseKeyValue(line);
  if (!entry) {
    return undefined;
  }
  return entry.value ? { type: 'pair', ...entry } : { type: 'section', ...entry };
}

function parseIndentedPair(line: string): { key: string; value: string } | undefined {
  if (!line.startsWith('  ') || line.startsWith('    ')) {
    return undefined;
  }
  const entry = parseKeyValue(line.slice(2));
  return entry?.value ? entry : undefined;
}

function parseRepositoryListTarget(line: string): 'include' | 'exclude' | undefined {
  if (!line.startsWith('  ') || line.startsWith('    ')) {
    return undefined;
  }
  const entry = parseKeyValue(line.slice(2));
  if (!entry || entry.value) {
    return undefined;
  }
  return entry.key === 'include' || entry.key === 'exclude' ? entry.key : undefined;
}

function parseListItem(line: string): string | undefined {
  const prefix = '    -';
  if (!line.startsWith(prefix)) {
    return undefined;
  }
  const value = line.slice(prefix.length).trimStart();
  return value || undefined;
}

function parseKeyValue(line: string): { key: string; value: string } | undefined {
  const colon = line.indexOf(':');
  if (colon <= 0) {
    return undefined;
  }
  const key = line.slice(0, colon);
  if (!isAlphaKey(key)) {
    return undefined;
  }
  return { key, value: line.slice(colon + 1).trimStart() };
}

function isAlphaKey(value: string): boolean {
  for (const char of value) {
    const code = char.charCodeAt(0);
    const isUpper = code >= 65 && code <= 90;
    const isLower = code >= 97 && code <= 122;
    if (!isUpper && !isLower) {
      return false;
    }
  }
  return value.length > 0;
}

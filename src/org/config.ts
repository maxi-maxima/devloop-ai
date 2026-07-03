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
    const line = raw.replace(/#.*$/, '');
    if (!line.trim()) {
      continue;
    }
    const topPair = line.match(/^([A-Za-z]+):\s*(.+)$/);
    if (topPair && !line.startsWith(' ')) {
      if (topPair[1] === 'organization') {
        config.organization = strip(topPair[2]!);
      }
      continue;
    }
    const topSection = line.match(/^([A-Za-z]+):\s*$/);
    if (topSection && !line.startsWith(' ')) {
      section = topSection[1]!;
      listTarget = undefined;
      continue;
    }
    if (section === 'defaults') {
      const pair = line.match(/^  ([A-Za-z]+):\s*(.+)$/);
      if (pair) {
        assignDefault(config, pair[1]!, pair[2]!);
      }
    }
    if (section === 'repositories') {
      const nested = line.match(/^  (include|exclude):\s*$/);
      if (nested) {
        listTarget = nested[1] as 'include' | 'exclude';
        config.repositories[listTarget] = [];
        continue;
      }
      const item = line.match(/^    -\s*(.+)$/);
      if (item && listTarget) {
        config.repositories[listTarget].push(strip(item[1]!));
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
  return value.trim().replace(/^["']|["']$/g, '');
}

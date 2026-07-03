import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { AgentAdapter, AgentAvailability, AgentSandboxMode, SupportedAgent } from './adapter-types.js';
import { claudeCodeAdapter } from './claude-code-adapter.js';
import { codexAdapter } from './codex-adapter.js';
import { cursorAgentAdapter } from './cursor-agent-adapter.js';
import { customAdapter } from './custom-adapter.js';

export interface AgentConfig {
  agents: Partial<Record<SupportedAgent, {
    enabled?: boolean;
    command?: string;
    sandbox?: AgentSandboxMode;
    defaultArgs?: string[];
  }>>;
  defaults: {
    dryRun: boolean;
    allowWrite: boolean;
    allowNetwork: boolean;
    requirePatchReview: boolean;
  };
}

export class AgentRegistry {
  constructor(private readonly adapters: AgentAdapter[]) {}

  list(): AgentAdapter[] {
    return [...this.adapters];
  }

  get(name: SupportedAgent): AgentAdapter {
    const adapter = this.adapters.find((item) => item.name === name);
    if (!adapter) {
      throw new Error(`Unsupported agent adapter: ${name}`);
    }
    return adapter;
  }

  async doctor(config: AgentConfig = defaultAgentConfig()): Promise<AgentAvailability[]> {
    return Promise.all(
      this.adapters.map((adapter) => {
        const agentConfig = config.agents[adapter.name];
        return adapter.checkAvailability(agentConfig?.command ?? adapter.defaultCommand);
      })
    );
  }
}

export function getAgentRegistry(): AgentRegistry {
  return new AgentRegistry([codexAdapter, claudeCodeAdapter, cursorAgentAdapter, customAdapter]);
}

export async function loadAgentConfig(repoPath: string): Promise<AgentConfig> {
  const file = path.join(repoPath, '.devloop-agents.yml');
  const text = await readFile(file, 'utf8').catch(() => '');
  return text ? parseAgentConfig(text) : defaultAgentConfig();
}

export function defaultAgentConfig(): AgentConfig {
  return {
    agents: {
      codex: {
        enabled: true,
        command: 'codex',
        sandbox: 'workspace-write',
        defaultArgs: ['exec']
      },
      custom: {
        enabled: true
      },
      'claude-code': {
        enabled: true,
        command: 'claude'
      },
      'cursor-agent': {
        enabled: true,
        command: 'cursor-agent'
      }
    },
    defaults: {
      dryRun: true,
      allowWrite: false,
      allowNetwork: false,
      requirePatchReview: true
    }
  };
}

function parseAgentConfig(text: string): AgentConfig {
  const config = defaultAgentConfig();
  let section: 'agents' | 'defaults' | undefined;
  let currentAgent: SupportedAgent | undefined;

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '');
    if (!line.trim()) {
      continue;
    }

    const top = line.match(/^([a-zA-Z]+):\s*$/);
    if (top) {
      section = top[1] === 'agents' || top[1] === 'defaults' ? top[1] : undefined;
      currentAgent = undefined;
      continue;
    }

    if (section === 'agents') {
      const agentMatch = line.match(/^  ([a-zA-Z-]+):\s*$/);
      if (agentMatch) {
        currentAgent = agentMatch[1] as SupportedAgent;
        config.agents[currentAgent] ??= {};
        continue;
      }
      const pair = line.match(/^    ([a-zA-Z]+):\s*(.+)\s*$/);
      if (pair && currentAgent) {
        assignAgentValue(config, currentAgent, pair[1]!, pair[2]!);
      }
    }

    if (section === 'defaults') {
      const pair = line.match(/^  ([a-zA-Z]+):\s*(.+)\s*$/);
      if (pair) {
        assignDefaultValue(config, pair[1]!, pair[2]!);
      }
    }
  }

  return config;
}

function assignAgentValue(config: AgentConfig, agent: SupportedAgent, key: string, value: string): void {
  const target = (config.agents[agent] ??= {});
  if (key === 'enabled') {
    target.enabled = parseBoolean(value);
  } else if (key === 'command') {
    target.command = parseString(value);
  } else if (key === 'sandbox') {
    target.sandbox = parseString(value) as AgentSandboxMode;
  }
}

function assignDefaultValue(config: AgentConfig, key: string, value: string): void {
  if (key === 'dryRun') config.defaults.dryRun = parseBoolean(value);
  if (key === 'allowWrite') config.defaults.allowWrite = parseBoolean(value);
  if (key === 'allowNetwork') config.defaults.allowNetwork = parseBoolean(value);
  if (key === 'requirePatchReview') config.defaults.requirePatchReview = parseBoolean(value);
}

function parseBoolean(value: string): boolean {
  return value.trim() === 'true';
}

function parseString(value: string): string {
  return value.trim().replace(/^["']|["']$/g, '');
}

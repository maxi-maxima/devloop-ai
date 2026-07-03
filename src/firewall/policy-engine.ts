import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { defaultFirewallPolicy } from './policies/default-policy.js';
import { permissiveFirewallPolicy } from './policies/permissive-policy.js';
import { strictFirewallPolicy } from './policies/strict-policy.js';
import type { FirewallCategory, FirewallPolicy } from './types.js';

export type FirewallRuntime = 'cli' | 'github_app';

export async function loadFirewallPolicy(
  repoPath: string,
  runtime: FirewallRuntime = 'cli'
): Promise<FirewallPolicy> {
  const configPath = path.join(repoPath, '.devloop-policy.yml');
  const content = await readFile(configPath, 'utf8').catch(() => '');
  return parseFirewallPolicy(content, runtime);
}

export function parseFirewallPolicy(content: string, runtime: FirewallRuntime = 'cli'): FirewallPolicy {
  const values = parseSimpleYaml(content);
  const mode = enumValue(values['firewall.mode'], ['strict', 'default', 'permissive'], runtime === 'github_app' ? 'strict' : 'default');
  const base = policyForMode(mode);

  return {
    ...base,
    mode,
    requireHumanApproval: categoryArray(values['firewall.requireHumanApproval'], base.requireHumanApproval),
    block: categoryArray(values['firewall.block'], base.block),
    allowedCommands: stringArray(values['firewall.allowedCommands'], base.allowedCommands),
    deniedCommands: stringArray(values['firewall.deniedCommands'], base.deniedCommands),
    maxPatchFiles: numberValue(values['firewall.maxPatchFiles'], base.maxPatchFiles),
    allowNetwork: booleanValue(values['firewall.allowNetwork'], base.allowNetwork),
    allowWorkflowPermissionChanges: booleanValue(
      values['firewall.allowWorkflowPermissionChanges'],
      base.allowWorkflowPermissionChanges
    )
  };
}

export function policyForMode(mode: FirewallPolicy['mode']): FirewallPolicy {
  if (mode === 'strict') {
    return strictFirewallPolicy();
  }
  if (mode === 'permissive') {
    return permissiveFirewallPolicy();
  }
  return defaultFirewallPolicy();
}

export function matchesCommandPattern(command: string, pattern: string): boolean {
  const normalized = command.trim().replace(/\s+/g, ' ');
  const normalizedPattern = pattern.trim().replace(/\s+/g, ' ');
  if (normalized === normalizedPattern || normalized.startsWith(`${normalizedPattern} `)) {
    return true;
  }
  const regex = new RegExp(
    `^${escapeRegex(normalizedPattern).replaceAll('\\*', '.*').replaceAll('\\?', '.')}(?:\\s|$)`,
    'i'
  );
  return regex.test(normalized);
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

function stringArray(value: unknown, fallback: string[]): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : fallback;
}

function categoryArray(value: unknown, fallback: FirewallCategory[]): FirewallCategory[] {
  const allowed: FirewallCategory[] = [
    'prompt_injection',
    'secret_exposure',
    'dangerous_command',
    'unsafe_patch',
    'supply_chain_risk',
    'policy_violation'
  ];
  return stringArray(value, fallback).filter((item): item is FirewallCategory =>
    allowed.includes(item as FirewallCategory)
  );
}

function numberValue(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function booleanValue(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function enumValue<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && allowed.includes(value as T) ? (value as T) : fallback;
}

function escapeRegex(value: string): string {
  return value.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
}

import path from 'node:path';
import {
  checkCommandRisk,
  checkInput,
  checkPatchRisk,
  loadFirewallPolicy,
  redactSecrets,
  scanRepositoryInstructions,
  type FirewallResult,
  type InputSource,
  type RedactionResult
} from '../firewall/index.js';
import { readTextFile } from '../utils/text-file.js';
import { assertMatchesSchema, DevLoopTool, JsonSchema } from './types.js';

export interface FirewallCheckInputToolInput {
  source: InputSource;
  text?: string;
  file?: string;
  repoPath?: string;
}

export interface FirewallCheckCommandToolInput {
  command: string;
  repoPath?: string;
}

export interface FirewallCheckPatchToolInput {
  repoPath: string;
  patch?: string;
  patchFile?: string;
}

export interface FirewallScanRepoToolInput {
  repoPath: string;
}

export interface FirewallRedactToolInput {
  text?: string;
  file?: string;
}

const findingSchema = {
  type: 'object',
  required: ['id', 'category', 'severity', 'source', 'message', 'evidence', 'recommendation'],
  additionalProperties: false,
  properties: {
    id: { type: 'string' },
    category: {
      type: 'string',
      enum: [
        'prompt_injection',
        'secret_exposure',
        'dangerous_command',
        'unsafe_patch',
        'supply_chain_risk',
        'policy_violation'
      ]
    },
    severity: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
    source: {
      type: 'string',
      enum: [
        'issue_body',
        'issue_comment',
        'pull_request_title',
        'pull_request_body',
        'pull_request_comment',
        'commit_message',
        'branch_name',
        'ci_log',
        'test_output',
        'repository_file',
        'user_prompt',
        'system_config'
      ]
    },
    message: { type: 'string' },
    evidence: { type: 'string' },
    recommendation: { type: 'string' }
  }
} satisfies JsonSchema;

export const firewallResultSchema = {
  type: 'object',
  required: ['decision', 'riskLevel', 'score', 'findings'],
  additionalProperties: false,
  properties: {
    decision: { type: 'string', enum: ['allow', 'block', 'redact', 'require_human_approval'] },
    riskLevel: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
    score: { type: 'number', minimum: 0, maximum: 100 },
    findings: { type: 'array', items: findingSchema },
    sanitizedText: { type: 'string' }
  }
} satisfies JsonSchema;

export const redactionResultSchema = {
  type: 'object',
  required: ['redactedText', 'findings', 'replacements'],
  additionalProperties: false,
  properties: {
    redactedText: { type: 'string' },
    findings: { type: 'array', items: findingSchema },
    replacements: {
      type: 'array',
      items: {
        type: 'object',
        required: ['label', 'count'],
        additionalProperties: false,
        properties: {
          label: { type: 'string' },
          count: { type: 'integer', minimum: 1 }
        }
      }
    }
  }
} satisfies JsonSchema;

export const firewallCheckInputSchema = {
  type: 'object',
  required: ['source'],
  additionalProperties: false,
  anyOf: [{ type: 'object', required: ['text'] }, { type: 'object', required: ['file'] }],
  properties: {
    source: findingSchema.properties.source,
    text: { type: 'string', minLength: 1 },
    file: { type: 'string', minLength: 1 },
    repoPath: { type: 'string', minLength: 1 }
  }
} satisfies JsonSchema;

export const firewallCheckCommandSchema = {
  type: 'object',
  required: ['command'],
  additionalProperties: false,
  properties: {
    command: { type: 'string', minLength: 1 },
    repoPath: { type: 'string', minLength: 1 }
  }
} satisfies JsonSchema;

export const firewallCheckPatchSchema = {
  type: 'object',
  required: ['repoPath'],
  additionalProperties: false,
  anyOf: [{ type: 'object', required: ['patch'] }, { type: 'object', required: ['patchFile'] }],
  properties: {
    repoPath: { type: 'string', minLength: 1 },
    patch: { type: 'string', minLength: 1 },
    patchFile: { type: 'string', minLength: 1 }
  }
} satisfies JsonSchema;

export const firewallScanRepoSchema = {
  type: 'object',
  required: ['repoPath'],
  additionalProperties: false,
  properties: {
    repoPath: { type: 'string', minLength: 1 }
  }
} satisfies JsonSchema;

export const firewallRedactSchema = {
  type: 'object',
  additionalProperties: false,
  anyOf: [{ type: 'object', required: ['text'] }, { type: 'object', required: ['file'] }],
  properties: {
    text: { type: 'string', minLength: 1 },
    file: { type: 'string', minLength: 1 }
  }
} satisfies JsonSchema;

export const firewallCheckInputTool: DevLoopTool<FirewallCheckInputToolInput, FirewallResult> = {
  name: 'devloop.firewall.checkInput',
  description: 'Detect prompt injection and secret exposure in untrusted issue, PR, CI, or repository text.',
  inputSchema: firewallCheckInputSchema,
  outputSchema: firewallResultSchema,
  async execute(input) {
    assertMatchesSchema(firewallCheckInputSchema, input, 'devloop.firewall.checkInput input');
    const repoPath = input.repoPath ? path.resolve(input.repoPath) : process.cwd();
    const policy = await loadFirewallPolicy(repoPath, 'cli');
    const text = input.text ?? (await readTextFile(path.resolve(input.file!)));
    const result = checkInput({ source: input.source, text, policy });
    assertMatchesSchema(firewallResultSchema, result, 'devloop.firewall.checkInput output');
    return result;
  }
};

export const firewallCheckCommandTool: DevLoopTool<FirewallCheckCommandToolInput, FirewallResult> = {
  name: 'devloop.firewall.checkCommand',
  description: 'Check a shell command against DevLoop Agent Firewall command safety rules and policy.',
  inputSchema: firewallCheckCommandSchema,
  outputSchema: firewallResultSchema,
  async execute(input) {
    assertMatchesSchema(firewallCheckCommandSchema, input, 'devloop.firewall.checkCommand input');
    const policy = await loadFirewallPolicy(input.repoPath ? path.resolve(input.repoPath) : process.cwd(), 'cli');
    const result = checkCommandRisk(input.command, policy);
    assertMatchesSchema(firewallResultSchema, result, 'devloop.firewall.checkCommand output');
    return result;
  }
};

export const firewallCheckPatchTool: DevLoopTool<FirewallCheckPatchToolInput, FirewallResult> = {
  name: 'devloop.firewall.checkPatch',
  description: 'Check a unified diff patch for unsafe edits, test disabling, secret exposure, and supply-chain risk.',
  inputSchema: firewallCheckPatchSchema,
  outputSchema: firewallResultSchema,
  async execute(input) {
    assertMatchesSchema(firewallCheckPatchSchema, input, 'devloop.firewall.checkPatch input');
    const repoPath = path.resolve(input.repoPath);
    const policy = await loadFirewallPolicy(repoPath, 'cli');
    const patch = input.patch ?? (await readTextFile(path.resolve(input.patchFile!)));
    const result = checkPatchRisk({ repoPath, patch }, policy);
    assertMatchesSchema(firewallResultSchema, result, 'devloop.firewall.checkPatch output');
    return result;
  }
};

export const firewallScanRepoTool: DevLoopTool<FirewallScanRepoToolInput, FirewallResult> = {
  name: 'devloop.firewall.scanRepo',
  description: 'Scan repository instructions and automation files for malicious agent instructions and unsafe scripts.',
  inputSchema: firewallScanRepoSchema,
  outputSchema: firewallResultSchema,
  async execute(input) {
    assertMatchesSchema(firewallScanRepoSchema, input, 'devloop.firewall.scanRepo input');
    const repoPath = path.resolve(input.repoPath);
    const policy = await loadFirewallPolicy(repoPath, 'cli');
    const result = await scanRepositoryInstructions(repoPath, policy);
    assertMatchesSchema(firewallResultSchema, result, 'devloop.firewall.scanRepo output');
    return result;
  }
};

export const firewallRedactTool: DevLoopTool<FirewallRedactToolInput, RedactionResult> = {
  name: 'devloop.firewall.redact',
  description: 'Redact known API keys, access tokens, private keys, and generic high-entropy secrets from text.',
  inputSchema: firewallRedactSchema,
  outputSchema: redactionResultSchema,
  async execute(input) {
    assertMatchesSchema(firewallRedactSchema, input, 'devloop.firewall.redact input');
    const text = input.text ?? (await readTextFile(path.resolve(input.file!)));
    const result = redactSecrets(text);
    assertMatchesSchema(redactionResultSchema, result, 'devloop.firewall.redact output');
    return result;
  }
};

export const firewallTools = [
  firewallCheckInputTool,
  firewallCheckCommandTool,
  firewallCheckPatchTool,
  firewallScanRepoTool,
  firewallRedactTool
] as const;

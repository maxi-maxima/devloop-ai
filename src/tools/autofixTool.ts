import path from 'node:path';
import { createAiProvider, providerConfigFromEnv } from '../ai/providers/index.js';
import { DemoProvider } from '../ai/providers/demo.js';
import { runAutoFix } from '../core/autofix.js';
import type { AutoFixResult, ProviderConfig } from '../core/types.js';
import { readTextFile } from '../utils/text-file.js';
import {
  assertMatchesSchema,
  autoFixResultSchema,
  DevLoopTool,
  JsonSchema
} from './types.js';

export type AutoFixToolProvider = ProviderConfig['provider'] | 'demo';

export interface AutoFixToolInput {
  repoPath: string;
  logFile: string;
  testCommand: string;
  dryRun?: boolean;
  maxRetries?: number;
  provider?: AutoFixToolProvider;
  model?: string;
  allowLockfile?: boolean;
  maxFiles?: number;
  timeoutMs?: number;
}

export const autofixInputSchema = {
  type: 'object',
  required: ['repoPath', 'logFile', 'testCommand'],
  additionalProperties: false,
  properties: {
    repoPath: {
      type: 'string',
      minLength: 1,
      description: 'Absolute or relative path to the repository to fix.'
    },
    logFile: {
      type: 'string',
      minLength: 1,
      description: 'Path to a file containing failed CI or test logs.'
    },
    testCommand: {
      type: 'string',
      minLength: 1,
      description: 'Command used to validate the generated fix.'
    },
    dryRun: {
      type: 'boolean',
      default: false,
      description: 'Preview the patch without applying it.'
    },
    maxRetries: {
      type: 'integer',
      minimum: 1,
      default: 3,
      description: 'Maximum number of patch attempts.'
    },
    provider: {
      type: 'string',
      enum: ['openai', 'anthropic', 'ollama', 'demo'],
      default: 'openai',
      description: 'AI provider used for patch generation.'
    },
    model: {
      type: 'string',
      minLength: 1,
      description: 'Optional model override for the selected provider.'
    },
    allowLockfile: {
      type: 'boolean',
      default: false,
      description: 'Allow package manager lockfile changes.'
    },
    maxFiles: {
      type: 'integer',
      minimum: 1,
      default: 5,
      description: 'Maximum number of files the generated patch may touch.'
    },
    timeoutMs: {
      type: 'integer',
      minimum: 1,
      description: 'Validation command timeout in milliseconds.'
    }
  }
} satisfies JsonSchema;

export const autofixTool: DevLoopTool<AutoFixToolInput, AutoFixResult> = {
  name: 'devloop.autofix',
  description:
    'Diagnose failed CI logs, generate a minimal patch, validate safety, apply when requested, and rerun tests.',
  inputSchema: autofixInputSchema,
  outputSchema: autoFixResultSchema,
  async execute(input) {
    assertMatchesSchema(autofixInputSchema, input, 'devloop.autofix input');

    const repoPath = path.resolve(input.repoPath);
    const log = await readTextFile(path.resolve(input.logFile));
    const provider = createProvider(input.provider, input.model);
    const result = await runAutoFix({
      repoPath,
      log,
      testCommand: input.testCommand,
      maxRetries: input.maxRetries ?? 3,
      dryRun: input.dryRun ?? false,
      noPr: true,
      provider,
      allowLockfile: input.allowLockfile,
      maxFiles: input.maxFiles,
      timeoutMs: input.timeoutMs
    });

    assertMatchesSchema(autoFixResultSchema, result, 'devloop.autofix output');
    return result;
  }
};

function createProvider(provider: AutoFixToolProvider = 'openai', model?: string) {
  if (provider === 'demo') {
    return new DemoProvider();
  }

  return createAiProvider(providerConfigFromEnv(provider, model));
}

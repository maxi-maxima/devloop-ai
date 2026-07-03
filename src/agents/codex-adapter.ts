import type {
  AgentAdapter,
  AgentAdapterRunInput,
  AgentCommandSpec,
  AgentSandboxMode
} from './adapter-types.js';
import { commandAvailability } from './command-utils.js';

export interface CodexCommandInput {
  repoPath: string;
  promptFile: string;
  command?: string;
  model?: string;
  outputFile?: string;
  sandbox?: AgentSandboxMode;
  unsafe?: boolean;
}

export async function buildCodexCommand(input: CodexCommandInput): Promise<AgentCommandSpec> {
  const sandbox = input.sandbox ?? 'read-only';
  if (sandbox === 'danger-full-access' && !input.unsafe) {
    throw new Error('Codex danger-full-access requires --unsafe.');
  }

  const executable = input.command ?? 'codex';
  const args = [
    'exec',
    '--cd',
    input.repoPath,
    '--sandbox',
    sandbox,
    '--prompt-file',
    input.promptFile
  ];
  if (input.model) {
    args.push('--model', input.model);
  }
  if (input.outputFile) {
    args.push('--output-file', input.outputFile);
  }

  return {
    executable,
    args,
    cwd: input.repoPath,
    display: [executable, ...args.map(quoteArg)].join(' ')
  };
}

export const codexAdapter: AgentAdapter = {
  name: 'codex',
  description: 'Run OpenAI Codex through `codex exec` with DevLoop guardrails.',
  defaultCommand: 'codex',
  buildCommand(input: AgentAdapterRunInput) {
    return buildCodexCommand(input);
  },
  checkAvailability(command?: string) {
    return commandAvailability('codex', command ?? 'codex');
  }
};

function quoteArg(value: string): string {
  return /\s/.test(value) ? JSON.stringify(value) : value;
}

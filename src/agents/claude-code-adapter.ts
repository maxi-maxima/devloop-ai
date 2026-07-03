import type { AgentAdapter, AgentAdapterRunInput } from './adapter-types.js';
import { commandAvailability } from './command-utils.js';

export const claudeCodeAdapter: AgentAdapter = {
  name: 'claude-code',
  description: 'Placeholder adapter for Claude Code. It is discoverable and reports availability.',
  defaultCommand: 'claude',
  async buildCommand(_input: AgentAdapterRunInput) {
    throw new Error('claude-code adapter is a placeholder. Configure custom command support to run it today.');
  },
  checkAvailability(command?: string) {
    return commandAvailability('claude-code', command ?? 'claude');
  }
};

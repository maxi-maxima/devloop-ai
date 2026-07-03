import type { AgentAdapter, AgentAdapterRunInput } from './adapter-types.js';
import { commandAvailability } from './command-utils.js';

export const cursorAgentAdapter: AgentAdapter = {
  name: 'cursor-agent',
  description: 'Placeholder adapter for Cursor Agent. It is discoverable and reports availability.',
  defaultCommand: 'cursor-agent',
  async buildCommand(_input: AgentAdapterRunInput) {
    throw new Error('cursor-agent adapter is a placeholder. Configure custom command support to run it today.');
  },
  checkAvailability(command?: string) {
    return commandAvailability('cursor-agent', command ?? 'cursor-agent');
  }
};

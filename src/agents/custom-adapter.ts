import type { AgentAdapter, AgentAdapterRunInput, AgentCommandSpec } from './adapter-types.js';
import { commandAvailability } from './command-utils.js';

export const customAdapter: AgentAdapter = {
  name: 'custom',
  description: 'Run a user-provided coding-agent command through DevLoop guardrails.',
  async buildCommand(input: AgentAdapterRunInput): Promise<AgentCommandSpec> {
    if (!input.command) {
      throw new Error('custom adapter requires --command.');
    }
    return {
      executable: input.command,
      args: [],
      cwd: input.repoPath,
      shell: true,
      display: input.command
    };
  },
  checkAvailability(command?: string) {
    return commandAvailability('custom', command);
  }
};

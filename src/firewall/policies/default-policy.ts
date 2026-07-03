import type { FirewallPolicy } from '../types.js';

export function defaultFirewallPolicy(): FirewallPolicy {
  return {
    mode: 'default',
    requireHumanApproval: ['dangerous_command', 'unsafe_patch', 'supply_chain_risk'],
    block: ['secret_exposure', 'prompt_injection'],
    allowedCommands: ['npm test', 'npm run test', 'npm run lint', 'pnpm test', 'yarn test', 'pytest', 'go test ./...', 'cargo test'],
    deniedCommands: ['printenv', 'env', 'cat .env', 'curl * | bash', 'wget * | sh'],
    maxPatchFiles: 5,
    allowNetwork: false,
    allowWorkflowPermissionChanges: false
  };
}

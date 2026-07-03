import { defaultFirewallPolicy } from './default-policy.js';
import type { FirewallPolicy } from '../types.js';

export function strictFirewallPolicy(): FirewallPolicy {
  const defaults = defaultFirewallPolicy();
  return {
    ...defaults,
    mode: 'strict',
    requireHumanApproval: ['dangerous_command', 'unsafe_patch', 'supply_chain_risk', 'policy_violation'],
    block: ['secret_exposure', 'prompt_injection', 'dangerous_command'],
    maxPatchFiles: 5,
    allowNetwork: false,
    allowWorkflowPermissionChanges: false
  };
}

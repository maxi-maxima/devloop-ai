import { defaultFirewallPolicy } from './default-policy.js';
import type { FirewallPolicy } from '../types.js';

export function permissiveFirewallPolicy(): FirewallPolicy {
  const defaults = defaultFirewallPolicy();
  return {
    ...defaults,
    mode: 'permissive',
    requireHumanApproval: ['dangerous_command', 'unsafe_patch'],
    block: ['secret_exposure'],
    maxPatchFiles: 20,
    allowNetwork: true,
    allowWorkflowPermissionChanges: false
  };
}

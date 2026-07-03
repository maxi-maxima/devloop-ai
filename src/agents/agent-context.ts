import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { checkInput, redactSecrets, type FirewallResult } from '../firewall/index.js';

export interface SafeAgentContext {
  prompt: string;
  promptFile: string;
  inputFirewall: FirewallResult;
}

export async function buildSafeAgentContext(input: {
  repoPath: string;
  prompt: string;
  runId: string;
}): Promise<SafeAgentContext> {
  const inputFirewall = checkInput({ source: 'user_prompt', text: input.prompt });
  const redacted = redactSecrets(input.prompt, 'user_prompt').redactedText;
  const dir = path.join(input.repoPath, '.devloop', 'agents');
  await mkdir(dir, { recursive: true });
  const promptFile = path.join(dir, `${input.runId}.md`);
  await writeFile(promptFile, redacted, 'utf8');

  return {
    prompt: redacted,
    promptFile,
    inputFirewall
  };
}

export function isBlockingFirewallResult(result: FirewallResult): boolean {
  return result.decision === 'block' || result.riskLevel === 'high' || result.riskLevel === 'critical';
}

export function isBlockingAgentInputResult(result: FirewallResult): boolean {
  const onlySecrets = result.findings.length > 0 && result.findings.every((finding) => finding.category === 'secret_exposure');
  if (onlySecrets) {
    return false;
  }
  return isBlockingFirewallResult(result);
}

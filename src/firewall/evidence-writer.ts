import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { formatFirewallReport } from './firewall-report.js';
import { redactSecrets } from './redactor.js';
import type { FirewallResult } from './types.js';

export async function writeFirewallEvidence(outputPath: string, result: FirewallResult): Promise<void> {
  await mkdir(path.dirname(outputPath), { recursive: true });
  const body =
    outputPath.endsWith('.md') || outputPath.endsWith('.markdown')
      ? formatFirewallReport(result)
      : JSON.stringify(result, null, 2);
  await writeFile(outputPath, `${redactSecrets(body, 'system_config').redactedText}\n`, 'utf8');
}

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { SecurityAlert } from './sarif-parser.js';

export async function buildSecurityContext(repoPath: string, alert: SecurityAlert): Promise<string> {
  const snippets: string[] = [];
  for (const location of alert.locations) {
    const fullPath = path.join(repoPath, location.uri);
    const content = await readFile(fullPath, 'utf8').catch(() => '');
    if (content) {
      snippets.push(`File: ${location.uri}\n${content}`);
    }
  }
  return snippets.join('\n\n');
}

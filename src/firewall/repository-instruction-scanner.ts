import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { checkCommandRisk } from './command-risk-detector.js';
import { defaultFirewallPolicy } from './policies/default-policy.js';
import { checkInput } from './prompt-injection-detector.js';
import { mergeFirewallResults } from './risk-score.js';
import type { FirewallFinding, FirewallPolicy, FirewallResult, RepositoryScanOptions } from './types.js';

const directInstructionFiles = [
  'README.md',
  'CONTRIBUTING.md',
  'AGENTS.md',
  'CLAUDE.md',
  'GEMINI.md',
  '.github/copilot-instructions.md',
  'Makefile',
  'Dockerfile',
  'package.json'
];

const recursiveRoots = ['.cursor/rules', '.github/workflows', 'scripts'];

export async function scanRepositoryInstructions(
  repoPath: string,
  policy: FirewallPolicy = defaultFirewallPolicy(),
  options: RepositoryScanOptions = {}
): Promise<FirewallResult> {
  const files = await candidateFiles(repoPath);
  const results: FirewallResult[] = [];
  const maxBytes = options.maxBytesPerFile ?? 200_000;

  for (const file of files) {
    const fullPath = path.join(repoPath, file);
    const content = await readFile(fullPath, 'utf8').catch(() => '');
    if (!content) {
      continue;
    }
    const sliced = content.length > maxBytes ? content.slice(0, maxBytes) : content;
    const inputResult = checkInput({
      source: 'repository_file',
      text: `${file}\n${sliced}`,
      policy
    });
    results.push(prefixFindings(inputResult, file));

    for (const command of extractCommands(file, sliced)) {
      results.push(prefixFindings(checkCommandRisk(command, policy), file));
    }
  }

  return mergeFirewallResults(results, policy);
}

async function candidateFiles(repoPath: string): Promise<string[]> {
  const files = new Set<string>();
  for (const file of directInstructionFiles) {
    files.add(file);
  }
  for (const root of recursiveRoots) {
    for (const file of await walkIfExists(path.join(repoPath, root), repoPath)) {
      files.add(file);
    }
  }
  return [...files];
}

async function walkIfExists(root: string, repoPath: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true }).catch(() => []);
  const result: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist') {
        continue;
      }
      result.push(...(await walkIfExists(fullPath, repoPath)));
    } else {
      result.push(path.relative(repoPath, fullPath).replace(/\\/g, '/'));
    }
  }
  return result;
}

function extractCommands(file: string, content: string): string[] {
  const commands: string[] = [];
  if (file.endsWith('package.json')) {
    try {
      const parsed = JSON.parse(content) as { scripts?: Record<string, unknown> };
      for (const value of Object.values(parsed.scripts ?? {})) {
        if (typeof value === 'string') {
          commands.push(value);
        }
      }
    } catch {
      return commands;
    }
  }

  if (file.endsWith('.yml') || file.endsWith('.yaml') || file === 'Makefile' || file === 'Dockerfile' || file.startsWith('scripts/')) {
    for (const line of content.split(/\r?\n/)) {
      const runMatch = line.match(/^\s*(?:run:|- run:)\s*(.+)$/);
      if (runMatch) {
        commands.push(runMatch[1]!);
      } else if (/\b(curl|wget|printenv|cat \.env|docker run|npm install|pip install)\b/i.test(line)) {
        commands.push(line.trim());
      }
    }
  }

  return commands;
}

function prefixFindings(result: FirewallResult, file: string): FirewallResult {
  return {
    ...result,
    findings: result.findings.map((finding): FirewallFinding => ({
      ...finding,
      id: `${file}:${finding.id}`,
      evidence: `${file}: ${finding.evidence}`
    }))
  };
}

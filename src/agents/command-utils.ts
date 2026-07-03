import { access } from 'node:fs/promises';
import path from 'node:path';
import type { AgentAvailability, SupportedAgent } from './adapter-types.js';

export async function commandAvailability(name: SupportedAgent, command?: string): Promise<AgentAvailability> {
  if (!command) {
    return { name, available: false, reason: 'No command configured.' };
  }

  const executable = firstCommandToken(command);
  const resolved = await findExecutable(executable);
  if (!resolved) {
    return {
      name,
      available: false,
      command: executable,
      reason: `Command not found on PATH: ${executable}`
    };
  }

  return { name, available: true, command: resolved };
}

export function firstCommandToken(command: string): string {
  const trimmed = command.trim();
  const quoted = trimmed.match(/^"([^"]+)"/);
  if (quoted) {
    return quoted[1]!;
  }
  return trimmed.split(/\s+/)[0] ?? trimmed;
}

async function findExecutable(command: string): Promise<string | undefined> {
  const hasPathSegment = command.includes('/') || command.includes('\\');
  const candidates = hasPathSegment ? [command] : pathCandidates(command);
  for (const candidate of candidates) {
    if (await canExecute(candidate)) {
      return candidate;
    }
  }
  return undefined;
}

function pathCandidates(command: string): string[] {
  const dirs = (process.env.PATH ?? '').split(path.delimiter).filter(Boolean);
  const extensions =
    process.platform === 'win32'
      ? (process.env.PATHEXT ?? '.EXE;.CMD;.BAT;.COM').split(';').filter(Boolean)
      : [''];
  return dirs.flatMap((dir) =>
    extensions.flatMap((extension) => [
      path.join(dir, command + extension),
      path.join(dir, command + extension.toLowerCase())
    ])
  );
}

async function canExecute(file: string): Promise<boolean> {
  return access(file).then(() => true, () => false);
}

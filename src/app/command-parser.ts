export type DevLoopCommand = 'help' | 'diagnose' | 'fix' | 'dry-run' | 'security-fix' | 'rerun';
export type ParsedDevLoopCommand =
  | {
      isCommand: false;
      raw: string;
    }
  | {
      isCommand: true;
      command: DevLoopCommand | 'unknown';
      knownCommand: boolean;
      args: string[];
      raw: string;
    };

const COMMANDS = new Set<DevLoopCommand>(['help', 'diagnose', 'fix', 'dry-run', 'security-fix', 'rerun']);

export function parseDevLoopCommand(body: string): ParsedDevLoopCommand {
  const raw = body.trim();
  const line = raw
    .split(/\r?\n/)
    .map((candidate) => candidate.trim())
    .find((candidate) => /^\/devloop(?:\s|$)/i.test(candidate));

  if (!line) {
    return { isCommand: false, raw };
  }

  const [, commandText = 'help', rest = ''] = line.match(/^\/devloop(?:\s+([a-z-]+))?(?:\s+(.*))?$/i) ?? [];
  const normalized = commandText.toLowerCase();
  const args = rest.trim() ? rest.trim().split(/\s+/) : [];

  if (COMMANDS.has(normalized as DevLoopCommand)) {
    return {
      isCommand: true,
      command: normalized as DevLoopCommand,
      knownCommand: true,
      args,
      raw
    };
  }

  return {
    isCommand: true,
    command: 'unknown',
    knownCommand: false,
    args: [normalized, ...args].filter(Boolean),
    raw
  };
}

export function devLoopHelpText(): string {
  return [
    'DevLoop AI commands:',
    '- /devloop help - show this help message',
    '- /devloop diagnose - inspect failing logs and post a root-cause summary',
    '- /devloop dry-run - generate and review a patch without pushing a PR',
    '- /devloop fix - generate a safe patch and open a PR when repo policy allows it',
    '- /devloop security-fix - run the security-focused autofix path',
    '- /devloop rerun - enqueue another DevLoop run for this pull request or issue'
  ].join('\n');
}

export function isMutatingCommand(command: DevLoopCommand): boolean {
  return command === 'fix' || command === 'security-fix' || command === 'rerun';
}

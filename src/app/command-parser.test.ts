import { describe, expect, test } from 'vitest';
import { devLoopHelpText, parseDevLoopCommand } from './command-parser.js';

describe('DevLoop comment command parser', () => {
  test('parses supported slash commands', () => {
    expect(parseDevLoopCommand('/devloop diagnose')).toMatchObject({ isCommand: true, command: 'diagnose' });
    expect(parseDevLoopCommand('please run\n/devloop dry-run')).toMatchObject({
      isCommand: true,
      command: 'dry-run'
    });
    expect(parseDevLoopCommand('/devloop security-fix codeql')).toMatchObject({
      isCommand: true,
      command: 'security-fix',
      args: ['codeql']
    });
  });

  test('reports unknown and non-command input clearly', () => {
    expect(parseDevLoopCommand('hello')).toEqual({ isCommand: false, raw: 'hello' });
    expect(parseDevLoopCommand('/devloop ship-it')).toMatchObject({
      isCommand: true,
      command: 'unknown',
      knownCommand: false
    });
  });

  test('includes every public command in help text', () => {
    for (const command of ['help', 'diagnose', 'fix', 'dry-run', 'security-fix', 'rerun']) {
      expect(devLoopHelpText()).toContain(`/devloop ${command}`);
    }
  });
});

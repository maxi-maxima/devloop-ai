import { spawn } from 'node:child_process';
import { RunnerCommand, RunnerResult, SandboxRunner } from './runner-types.js';

export interface DockerRunnerOptions {
  image?: string;
  timeoutMs?: number;
  outputLimit?: number;
}

export class DockerRunner implements SandboxRunner {
  readonly kind = 'docker' as const;

  constructor(private readonly options: DockerRunnerOptions = {}) {}

  async run(command: RunnerCommand): Promise<RunnerResult> {
    const image = this.options.image ?? 'node:20-alpine';
    const args = [
      'run',
      '--rm',
      '--user',
      '1000:1000',
      '--network',
      command.allowNetwork ? 'bridge' : 'none',
      '-v',
      `${command.repoPath}:/workspace`,
      '-w',
      '/workspace',
      image,
      'sh',
      '-lc',
      command.command
    ];
    return runDocker(args, command, this.options);
  }
}

export async function isDockerAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn('docker', ['--version'], { shell: false });
    child.on('error', () => resolve(false));
    child.on('close', (code) => resolve(code === 0));
  });
}

async function runDocker(
  args: string[],
  command: RunnerCommand,
  options: DockerRunnerOptions
): Promise<RunnerResult> {
  const started = Date.now();
  const timeoutMs = command.timeoutMs ?? options.timeoutMs ?? 10 * 60 * 1000;
  const outputLimit = command.outputLimit ?? options.outputLimit ?? 1024 * 1024;
  const result = await new Promise<{ code: number | null; stdout: string; stderr: string; timedOut: boolean }>(
    (resolve) => {
      const child = spawn('docker', args, { shell: false, env: { PATH: process.env.PATH } });
      let stdout = '';
      let stderr = '';
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        child.kill('SIGTERM');
      }, timeoutMs);
      child.stdout.on('data', (chunk) => {
        stdout = appendLimited(stdout, String(chunk), outputLimit);
      });
      child.stderr.on('data', (chunk) => {
        stderr = appendLimited(stderr, String(chunk), outputLimit);
      });
      child.on('close', (code) => {
        clearTimeout(timer);
        resolve({ code, stdout, stderr, timedOut });
      });
    }
  );

  return {
    command: command.command,
    exitCode: result.code,
    stdout: result.stdout,
    stderr: result.stderr,
    durationMs: Date.now() - started,
    passed: result.code === 0 && !result.timedOut,
    timedOut: result.timedOut,
    sandbox: {
      kind: 'docker',
      network: command.allowNetwork ? 'enabled' : 'disabled',
      user: '1000:1000'
    }
  };
}

function appendLimited(existing: string, next: string, limit: number): string {
  const combined = existing + next;
  return combined.length <= limit ? combined : combined.slice(0, limit);
}

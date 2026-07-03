import { spawn } from 'node:child_process';
import { RunnerCommand, RunnerResult, SandboxRunner } from './runner-types.js';

export interface LocalRunnerOptions {
  allowLocalRunner: boolean;
  timeoutMs?: number;
  outputLimit?: number;
}

export class LocalRunner implements SandboxRunner {
  readonly kind = 'local' as const;

  constructor(private readonly options: LocalRunnerOptions) {}

  async run(command: RunnerCommand): Promise<RunnerResult> {
    if (!this.options.allowLocalRunner) {
      throw new Error('Local runner is disabled. Pass --allow-local-runner to enable it explicitly.');
    }

    const started = Date.now();
    const timeoutMs = command.timeoutMs ?? this.options.timeoutMs ?? 10 * 60 * 1000;
    const outputLimit = command.outputLimit ?? this.options.outputLimit ?? 1024 * 1024;
    const env = sanitizedEnv(process.env);

    const result = await new Promise<{ code: number | null; stdout: string; stderr: string; timedOut: boolean }>(
      (resolve) => {
        const child = spawn(command.command, {
          cwd: command.repoPath,
          shell: true,
          env
        });
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
        kind: 'local',
        network: 'host',
        user: process.env.USERNAME ?? process.env.USER ?? 'local-user'
      }
    };
  }
}

function sanitizedEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const safe: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(env)) {
    if (/TOKEN|SECRET|PRIVATE_KEY|GITHUB_APP|OPENAI_API_KEY/i.test(key)) {
      continue;
    }
    safe[key] = value;
  }
  return safe;
}

function appendLimited(existing: string, next: string, limit: number): string {
  const combined = existing + next;
  return combined.length <= limit ? combined : combined.slice(0, limit);
}

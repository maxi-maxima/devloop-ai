export interface RunnerCommand {
  repoPath: string;
  command: string;
  timeoutMs?: number;
  outputLimit?: number;
  allowNetwork?: boolean;
}

export interface RunnerResult {
  command: string;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  durationMs: number;
  passed: boolean;
  timedOut: boolean;
  sandbox: {
    kind: 'local' | 'docker';
    network: 'disabled' | 'enabled' | 'host';
    user: string;
  };
}

export interface SandboxRunner {
  readonly kind: 'local' | 'docker';
  run(command: RunnerCommand): Promise<RunnerResult>;
}

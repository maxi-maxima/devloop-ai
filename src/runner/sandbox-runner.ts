import { DockerRunner, isDockerAvailable } from './docker-runner.js';
import { LocalRunner } from './local-runner.js';
import { SandboxRunner } from './runner-types.js';

export interface CreateSandboxRunnerOptions {
  allowLocalRunner?: boolean;
  timeoutMs?: number;
  outputLimit?: number;
}

export async function createSandboxRunner(options: CreateSandboxRunnerOptions = {}): Promise<SandboxRunner> {
  if (await isDockerAvailable()) {
    return new DockerRunner({ timeoutMs: options.timeoutMs, outputLimit: options.outputLimit });
  }

  if (options.allowLocalRunner) {
    return new LocalRunner({
      allowLocalRunner: true,
      timeoutMs: options.timeoutMs,
      outputLimit: options.outputLimit
    });
  }

  throw new Error('Docker is not available and local runner is disabled.');
}

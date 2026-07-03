import { spawn } from 'node:child_process';
import { TestResult } from './types.js';

export async function runTestCommand(
  repoPath: string,
  command: string,
  timeoutMs = 120_000
): Promise<TestResult> {
  const startedAt = Date.now();

  return await new Promise<TestResult>((resolve) => {
    const child = spawn(command, {
      cwd: repoPath,
      shell: true,
      env: process.env
    });
    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
    }, timeoutMs);

    child.stdout.on('data', (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });
    child.on('close', (exitCode) => {
      clearTimeout(timer);
      resolve({
        command,
        exitCode,
        stdout,
        stderr,
        durationMs: Date.now() - startedAt,
        passed: exitCode === 0 && !timedOut,
        timedOut
      });
    });
  });
}

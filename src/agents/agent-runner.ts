import { spawn } from 'node:child_process';
import path from 'node:path';
import { applyUnifiedDiff } from '../core/patcher.js';
import { runTestCommand } from '../core/test-runner.js';
import type { TestResult } from '../core/types.js';
import { createEvidenceBundle } from '../evidence/index.js';
import {
  checkCommandRisk,
  checkPatchRisk,
  loadFirewallPolicy,
  redactSecrets,
  type FirewallResult
} from '../firewall/index.js';
import { buildSafeAgentContext, isBlockingAgentInputResult, isBlockingFirewallResult } from './agent-context.js';
import { extractPatchFromAgentOutput } from './agent-output-parser.js';
import type {
  AgentCommandSpec,
  AgentRunInput,
  AgentRunResult,
  AgentRunStatus
} from './adapter-types.js';
import { defaultAgentConfig, getAgentRegistry, loadAgentConfig } from './agent-registry.js';

interface ProcessResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

export async function runAgent(input: AgentRunInput): Promise<AgentRunResult> {
  const repoPath = path.resolve(input.repoPath);
  const config = await loadAgentConfig(repoPath).catch(() => defaultAgentConfig());
  const defaults = config.defaults;
  const dryRun = input.dryRun ?? defaults.dryRun;
  const allowWrite = input.allowWrite ?? defaults.allowWrite;
  const allowNetwork = input.allowNetwork ?? defaults.allowNetwork;
  const unsafe = input.unsafe ?? false;
  const registry = getAgentRegistry();
  const adapter = registry.get(input.agent);
  const runId = `agent-${Date.now()}`;
  const context = await buildSafeAgentContext({ repoPath, prompt: input.prompt, runId });

  if (isBlockingAgentInputResult(context.inputFirewall)) {
    return finalizeAgentRun(repoPath, input, {
      status: 'blocked',
      adapter: input.agent,
      dryRun,
      applied: false,
      stdout: '',
      stderr: '',
      firewall: {
        input: context.inputFirewall
      },
      reason: context.inputFirewall.findings[0]?.message ?? 'Agent input blocked by DevLoop Firewall.'
    });
  }

  const agentConfig = config.agents[input.agent];
  if (agentConfig?.enabled === false) {
    return finalizeAgentRun(repoPath, input, {
      status: 'failed',
      adapter: input.agent,
      dryRun,
      applied: false,
      stdout: '',
      stderr: '',
      firewall: {
        input: context.inputFirewall
      },
      reason: `Agent adapter is disabled in .devloop-agents.yml: ${input.agent}`
    });
  }

  const availability = await adapter.checkAvailability(input.command ?? agentConfig?.command ?? adapter.defaultCommand);
  if (!availability.available) {
    return finalizeAgentRun(repoPath, input, {
      status: 'failed',
      adapter: input.agent,
      dryRun,
      applied: false,
      stdout: '',
      stderr: '',
      firewall: {
        input: context.inputFirewall
      },
      reason: availability.reason ?? `Agent command is not available: ${input.agent}`
    });
  }

  let command: AgentCommandSpec;
  try {
    command = await adapter.buildCommand({
      repoPath,
      promptFile: context.promptFile,
      prompt: context.prompt,
      command: input.command ?? agentConfig?.command ?? adapter.defaultCommand,
      model: input.model,
      outputFile: input.outputFile,
      sandbox: input.sandbox ?? agentConfig?.sandbox ?? (allowWrite ? 'workspace-write' : 'read-only'),
      unsafe
    });
  } catch (error) {
    return finalizeAgentRun(repoPath, input, {
      status: 'failed',
      adapter: input.agent,
      dryRun,
      applied: false,
      stdout: '',
      stderr: '',
      firewall: {
        input: context.inputFirewall
      },
      reason: error instanceof Error ? error.message : String(error)
    });
  }

  const policy = await loadFirewallPolicy(repoPath, 'cli');
  const commandFirewall = checkCommandRisk(command.display, {
    ...policy,
    allowNetwork
  });
  if (isBlockingFirewallResult(commandFirewall)) {
    return finalizeAgentRun(repoPath, input, {
      status: 'blocked',
      adapter: input.agent,
      dryRun,
      applied: false,
      command: command.display,
      stdout: '',
      stderr: '',
      firewall: {
        input: context.inputFirewall,
        command: commandFirewall
      },
      reason: commandFirewall.findings[0]?.message ?? 'Agent command blocked by DevLoop Firewall.'
    });
  }

  const processResult = await runControlledSubprocess(command, {
    timeoutMs: input.timeoutMs ?? 120_000,
    allowSecrets: false
  });
  const stdout = redactSecrets(processResult.stdout, 'test_output').redactedText;
  const stderr = redactSecrets(processResult.stderr, 'test_output').redactedText;
  const patch = extractPatchFromAgentOutput([stdout, stderr].join('\n'));

  if (processResult.exitCode !== 0) {
    return finalizeAgentRun(repoPath, input, {
      status: 'failed',
      adapter: input.agent,
      dryRun,
      applied: false,
      command: command.display,
      exitCode: processResult.exitCode,
      stdout,
      stderr,
      patch,
      firewall: {
        input: context.inputFirewall,
        command: commandFirewall
      },
      reason: processResult.timedOut ? 'Agent command timed out.' : 'Agent command exited with a non-zero status.'
    });
  }

  if (!patch) {
    return finalizeAgentRun(repoPath, input, {
      status: 'failed',
      adapter: input.agent,
      dryRun,
      applied: false,
      command: command.display,
      exitCode: processResult.exitCode,
      stdout,
      stderr,
      firewall: {
        input: context.inputFirewall,
        command: commandFirewall
      },
      reason: 'Agent did not output a unified diff patch.'
    });
  }

  const patchReview = checkPatchRisk({ repoPath, patch }, policy);
  if (isBlockingFirewallResult(patchReview)) {
    return finalizeAgentRun(repoPath, input, {
      status: 'unsafe',
      adapter: input.agent,
      dryRun,
      applied: false,
      command: command.display,
      exitCode: processResult.exitCode,
      stdout,
      stderr,
      patch,
      patchReview,
      firewall: {
        input: context.inputFirewall,
        command: commandFirewall,
        patch: patchReview
      },
      reason: patchReview.findings[0]?.message ?? 'Agent patch blocked by DevLoop Firewall.'
    });
  }

  if (dryRun) {
    return finalizeAgentRun(repoPath, input, {
      status: 'dry-run',
      adapter: input.agent,
      dryRun,
      applied: false,
      command: command.display,
      exitCode: processResult.exitCode,
      stdout,
      stderr,
      patch,
      patchReview,
      firewall: {
        input: context.inputFirewall,
        command: commandFirewall,
        patch: patchReview
      }
    });
  }

  if (!allowWrite) {
    return finalizeAgentRun(repoPath, input, {
      status: 'blocked',
      adapter: input.agent,
      dryRun,
      applied: false,
      command: command.display,
      exitCode: processResult.exitCode,
      stdout,
      stderr,
      patch,
      patchReview,
      firewall: {
        input: context.inputFirewall,
        command: commandFirewall,
        patch: patchReview
      },
      reason: 'Write mode requires --allow-write.'
    });
  }

  await applyUnifiedDiff(repoPath, patch);
  const testResult = input.testCommand ? await runTestCommand(repoPath, input.testCommand, input.timeoutMs) : undefined;
  return finalizeAgentRun(repoPath, input, {
    status: testResult && !testResult.passed ? 'failed' : 'completed',
    adapter: input.agent,
    dryRun,
    applied: true,
    command: command.display,
    exitCode: processResult.exitCode,
    stdout,
    stderr,
    patch,
    patchReview,
    testResult,
    firewall: {
      input: context.inputFirewall,
      command: commandFirewall,
      patch: patchReview
    },
    reason: testResult && !testResult.passed ? 'Validation test command failed.' : undefined
  });
}

async function finalizeAgentRun(
  repoPath: string,
  input: AgentRunInput,
  result: AgentRunResult
): Promise<AgentRunResult> {
  const firewall = highestFirewallResult([
    result.firewall.patch,
    result.firewall.command,
    result.firewall.input
  ]);
  const testAfterLog = result.testResult ? [result.testResult.stdout, result.testResult.stderr].join('\n') : '';
  const evidence = await createEvidenceBundle({
    repoPath,
    trigger: {
      type: `agent.${input.agent}`
    },
    model: {
      provider: input.agent,
      model: input.model ?? 'external-agent'
    },
    sandbox: {
      runner: 'local',
      network: input.allowNetwork ? 'enabled' : 'disabled',
      secretsMounted: false,
      timeoutSeconds: Math.ceil((input.timeoutMs ?? 120_000) / 1000),
      user: process.env.USERNAME ?? process.env.USER ?? 'unknown'
    },
    diagnosis: {
      summary: result.reason ?? agentSummary(result.status, input.agent),
      confidence: result.status === 'failed' ? 0.4 : 0.8,
      likelyFiles: result.patchReview?.findings.map((finding) => finding.evidence) ?? []
    },
    patch: result.patch ?? '',
    testBeforeLog: [result.stdout, result.stderr].filter(Boolean).join('\n'),
    testAfterLog,
    validationCommands: [
      ...(result.command
        ? [
            {
              command: result.command,
              exitCode: result.exitCode ?? -1,
              durationMs: 0,
              passed: result.exitCode === 0,
              logName: 'test-before.log'
            }
          ]
        : []),
      ...(result.testResult
        ? [
            {
              command: result.testResult.command,
              exitCode: result.testResult.exitCode,
              durationMs: result.testResult.durationMs,
              passed: result.testResult.passed,
              logName: 'test-after.log'
            }
          ]
        : [])
    ],
    firewall: {
      decision: firewall.decision,
      riskLevel: firewall.riskLevel,
      findingsCount: firewall.findings.length
    },
    metadata: {
      adapter: input.agent,
      dryRun: result.dryRun,
      applied: result.applied
    }
  });

  return {
    ...result,
    evidence: {
      runId: evidence.runId,
      path: evidence.path
    }
  };
}

async function runControlledSubprocess(
  command: AgentCommandSpec,
  options: { timeoutMs: number; allowSecrets: boolean }
): Promise<ProcessResult> {
  return new Promise((resolve) => {
    const child = spawn(command.executable, command.args, {
      cwd: command.cwd,
      shell: command.shell ?? false,
      env: options.allowSecrets ? process.env : safeEnvironment(command.env)
    });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
    }, options.timeoutMs);

    child.stdout?.on('data', (chunk) => {
      stdout += String(chunk);
    });
    child.stderr?.on('data', (chunk) => {
      stderr += String(chunk);
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      resolve({ exitCode: 1, stdout, stderr: `${stderr}\n${error.message}`.trim(), timedOut });
    });
    child.on('close', (exitCode) => {
      clearTimeout(timer);
      resolve({ exitCode, stdout, stderr, timedOut });
    });
  });
}

function safeEnvironment(extra?: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const allowed = [
    'PATH',
    'Path',
    'PATHEXT',
    'SYSTEMROOT',
    'SystemRoot',
    'COMSPEC',
    'TEMP',
    'TMP',
    'HOME',
    'USERPROFILE',
    'APPDATA',
    'LOCALAPPDATA',
    'PROGRAMFILES',
    'ProgramFiles',
    'NODE_PATH'
  ];
  const env: NodeJS.ProcessEnv = {};
  for (const key of allowed) {
    if (process.env[key]) {
      env[key] = process.env[key];
    }
  }
  return { ...env, ...extra };
}

function highestFirewallResult(results: Array<FirewallResult | undefined>): FirewallResult {
  const present = results.filter((result): result is FirewallResult => Boolean(result));
  return present.reduce((highest, current) => (riskScore(current.riskLevel) > riskScore(highest.riskLevel) ? current : highest));
}

function riskScore(risk: FirewallResult['riskLevel']): number {
  return { low: 1, medium: 2, high: 3, critical: 4 }[risk];
}

function agentSummary(status: AgentRunStatus, agent: string): string {
  if (status === 'dry-run') {
    return `${agent} produced a patch preview.`;
  }
  if (status === 'completed') {
    return `${agent} produced and applied a patch.`;
  }
  return `${agent} run ended with status ${status}.`;
}

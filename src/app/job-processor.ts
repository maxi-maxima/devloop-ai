import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { simpleGit } from 'simple-git';
import { autofixTool } from '../tools/autofixTool.js';
import { diagnoseTool } from '../tools/diagnoseTool.js';
import { createPrFromLocalChanges } from '../core/git-workflow.js';
import {
  checkCommandRisk,
  checkInput,
  checkPatchRisk,
  loadFirewallPolicy,
  redactSecrets,
  scanRepositoryInstructions,
  type FirewallResult
} from '../firewall/index.js';
import { defaultRepositoryPolicy, RepositoryPolicy } from './config.js';
import { JobRecord, JobStore } from './job-store.js';
import { fetchWorkflowRunLogs, WorkflowFetchLike } from '../github-app/workflow-logs.js';
import { postStatusComment } from './status-commenter.js';

export interface ProcessWorkflowRunJobInput {
  job: JobRecord;
  payload: unknown;
  token: string;
  store: JobStore;
  policy?: Partial<RepositoryPolicy>;
  workspaceRoot?: string;
  fetchImpl?: WorkflowFetchLike;
  provider?: 'openai' | 'anthropic' | 'ollama' | 'demo';
}

export async function processWorkflowRunJob(input: ProcessWorkflowRunJobInput): Promise<void> {
  await input.store.updateJob(input.job.id, {
    status: 'running',
    startedAt: new Date().toISOString()
  });
  await input.store.appendJobLog(input.job.id, 'diagnosis started');

  try {
    const payload = asRecord(input.payload);
    const workflowRun = asRecord(payload.workflow_run);
    const repository = requiredString(asRecord(payload.repository).full_name, 'repository.full_name');
    const [owner, repo] = splitRepository(repository);
    const runId = requiredNumber(workflowRun.id, 'workflow_run.id');
    const pullRequestNumber = pullRequestNumberFromWorkflowRun(workflowRun);
    const policy = mergePolicy(input.policy);
    const logs = await fetchWorkflowRunLogs({
      owner,
      repo,
      runId,
      token: input.token,
      fetchImpl: input.fetchImpl
    });
    const githubAppFirewallPolicy = await loadFirewallPolicy(input.workspaceRoot ?? process.cwd(), 'github_app');
    const eventFirewall = checkInput({
      source: 'system_config',
      text: JSON.stringify(input.payload),
      policy: githubAppFirewallPolicy
    });
    const logFirewall = checkInput({
      source: 'ci_log',
      text: logs,
      policy: githubAppFirewallPolicy
    });
    const blockedBeforeClone = await blockIfUnsafe({
      store: input.store,
      job: input.job,
      phase: 'workflow_run',
      results: [eventFirewall, logFirewall],
      comment: { owner, repo, issueNumber: pullRequestNumber, token: input.token }
    });
    if (blockedBeforeClone) {
      return;
    }

    if (policy.autofix.mode === 'dry-run') {
      const diagnosis = await diagnoseTool.execute({
        repoPath: input.workspaceRoot ?? process.cwd(),
        logText: logs
      });
      await input.store.updateJob(input.job.id, {
        status: 'succeeded',
        completedAt: new Date().toISOString(),
        diagnosisJson: JSON.stringify(diagnosis),
        patchSummary: diagnosis.recommended_fix_strategy
      });
      await input.store.appendJobLog(input.job.id, 'dry-run diagnosis completed');
      return;
    }

    if (!policy.autofix.testCommand) {
      throw new Error('PR mode requires autofix.testCommand in .devloop.yml.');
    }

    const workspace = await cloneRepository({
      repository,
      token: input.token,
      workspaceRoot: input.workspaceRoot
    });
    const firewallPolicy = await loadFirewallPolicy(workspace, 'github_app');
    const repoScan = await scanRepositoryInstructions(workspace, firewallPolicy);
    const blockedByRepoScan = await blockIfUnsafe({
      store: input.store,
      job: input.job,
      phase: 'repository scan',
      results: [repoScan],
      comment: { owner, repo, issueNumber: pullRequestNumber, token: input.token }
    });
    if (blockedByRepoScan) {
      return;
    }
    if (policy.autofix.installCommand) {
      const installFirewall = checkCommandRisk(policy.autofix.installCommand, firewallPolicy);
      const blockedInstall = await blockIfUnsafe({
        store: input.store,
        job: input.job,
        phase: 'install command',
        results: [installFirewall],
        comment: { owner, repo, issueNumber: pullRequestNumber, token: input.token }
      });
      if (blockedInstall) {
        return;
      }
      await simpleGit(workspace).raw(['status']);
      await runShell(workspace, policy.autofix.installCommand);
    }
    const testCommandFirewall = checkCommandRisk(policy.autofix.testCommand, firewallPolicy);
    const blockedTestCommand = await blockIfUnsafe({
      store: input.store,
      job: input.job,
      phase: 'test command',
      results: [testCommandFirewall],
      comment: { owner, repo, issueNumber: pullRequestNumber, token: input.token }
    });
    if (blockedTestCommand) {
      return;
    }

    const logFile = path.join(workspace, '.devloop-failure.log');
    await writeFile(logFile, logs, 'utf8');
    const result = await autofixTool.execute({
      repoPath: workspace,
      logFile,
      testCommand: policy.autofix.testCommand,
      maxRetries: policy.autofix.maxRetries,
      dryRun: false,
      provider: input.provider ?? 'openai',
      allowLockfile: policy.autofix.allowLockfileEdits,
      maxFiles: policy.autofix.maxFilesChanged
    });

    await input.store.updateJob(input.job.id, {
      diagnosisJson: JSON.stringify(result.diagnosis),
      patchSummary: result.diagnosis.recommended_fix_strategy
    });

    if (result.status !== 'fixed') {
      await input.store.updateJob(input.job.id, {
        status: result.status === 'unsafe' ? 'unsafe' : 'failed',
        completedAt: new Date().toISOString(),
        failureReason: result.reason ?? `autofix status: ${result.status}`
      });
      await input.store.appendJobLog(input.job.id, 'failure reason recorded');
      return;
    }

    if (result.patch) {
      const patchFirewall = checkPatchRisk({ repoPath: workspace, patch: result.patch }, firewallPolicy);
      const blockedPatch = await blockIfUnsafe({
        store: input.store,
        job: input.job,
        phase: 'patch review',
        results: [patchFirewall],
        comment: { owner, repo, issueNumber: pullRequestNumber, token: input.token }
      });
      if (blockedPatch) {
        return;
      }
    }

    const safePrBody = redactSecrets(result.prBody ?? 'Automated CI fix generated by DevLoop AI.').redactedText;
    const pr = await createPrFromLocalChanges({
      repoPath: workspace,
      token: input.token,
      title: 'fix(ci): auto-fix failing tests with DevLoop',
      body: safePrBody
    });
    if (result.evidence) {
      await postStatusComment({
        owner,
        repo,
        issueNumber: pr.number,
        token: input.token,
        status: 'DevLoop evidence bundle recorded',
        details: [
          `Run ID: ${result.evidence.runId}`,
          `Evidence path: ${result.evidence.path}`,
          `Test command: ${policy.autofix.testCommand}`,
          'Human review required before merge.'
        ].join('\n')
      }).catch(async (error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        await input.store.appendJobLog(input.job.id, `evidence comment failed: ${message}`);
      });
    }
    await input.store.updateJob(input.job.id, {
      status: 'succeeded',
      completedAt: new Date().toISOString(),
      prUrl: pr.url,
      branch: pr.branch
    });
    await input.store.appendJobLog(input.job.id, 'PR created');
  } catch (error) {
    await input.store.updateJob(input.job.id, {
      status: 'failed',
      completedAt: new Date().toISOString(),
      failureReason: sanitizeError(error, input.token)
    });
    await input.store.appendJobLog(input.job.id, 'job failed');
  }
}

async function blockIfUnsafe(input: {
  store: JobStore;
  job: JobRecord;
  phase: string;
  results: FirewallResult[];
  comment?: {
    owner: string;
    repo: string;
    issueNumber?: number;
    token: string;
  };
}): Promise<boolean> {
  const blocking = input.results.find(
    (result) => result.decision === 'block' || result.riskLevel === 'critical' || result.riskLevel === 'high'
  );
  if (!blocking) {
    return false;
  }

  const reason = [
    `Agent Firewall blocked ${input.phase}.`,
    `Decision: ${blocking.decision}.`,
    `Risk: ${blocking.riskLevel}.`,
    blocking.findings[0] ? `Finding: ${blocking.findings[0].message}` : undefined
  ]
    .filter(Boolean)
    .join(' ');

  await input.store.updateJob(input.job.id, {
    status: 'unsafe',
    completedAt: new Date().toISOString(),
    failureReason: reason
  });
  await input.store.appendJobLog(input.job.id, reason);
  if (input.comment?.issueNumber) {
    await postStatusComment({
      owner: input.comment.owner,
      repo: input.comment.repo,
      issueNumber: input.comment.issueNumber,
      token: input.comment.token,
      status: 'Agent Firewall blocked this run',
      details: `${reason}\n\nSafe next step: review the flagged text, command, or patch manually before rerunning DevLoop.`
    }).catch(async (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      await input.store.appendJobLog(input.job.id, `firewall comment failed: ${message}`);
    });
  }
  return true;
}

function pullRequestNumberFromWorkflowRun(workflowRun: Record<string, unknown>): number | undefined {
  const pullRequests = workflowRun.pull_requests;
  if (!Array.isArray(pullRequests)) {
    return undefined;
  }
  const first = pullRequests[0];
  if (typeof first !== 'object' || first === null) {
    return undefined;
  }
  const number = (first as Record<string, unknown>).number;
  return typeof number === 'number' && Number.isFinite(number) ? number : undefined;
}

async function cloneRepository(input: {
  repository: string;
  token: string;
  workspaceRoot?: string;
}): Promise<string> {
  const workspaceRoot = input.workspaceRoot ?? (await mkdtemp(path.join(tmpdir(), 'devloop-app-')));
  const repoPath = path.join(workspaceRoot, input.repository.replace(/[\\/]/g, '-'));
  const remote = `https://x-access-token:${encodeURIComponent(input.token)}@github.com/${input.repository}.git`;
  await simpleGit().clone(remote, repoPath, ['--depth', '1']);
  return repoPath;
}

async function runShell(cwd: string, command: string): Promise<void> {
  const { spawn } = await import('node:child_process');
  const result = await new Promise<{ code: number | null; output: string }>((resolve) => {
    const child = spawn(command, { cwd, shell: true, env: process.env });
    let output = '';
    child.stdout.on('data', (chunk) => {
      output += String(chunk);
    });
    child.stderr.on('data', (chunk) => {
      output += String(chunk);
    });
    child.on('close', (code) => resolve({ code, output }));
  });
  if (result.code !== 0) {
    throw new Error(`Install command failed: ${result.output.slice(0, 2000)}`);
  }
}

function mergePolicy(partial?: Partial<RepositoryPolicy>): RepositoryPolicy {
  const defaults = defaultRepositoryPolicy();
  return {
    ...defaults,
    ...partial,
    autofix: { ...defaults.autofix, ...partial?.autofix },
    security: { ...defaults.security, ...partial?.security },
    comments: { ...defaults.comments, ...partial?.comments }
  };
}

function splitRepository(repository: string): [string, string] {
  const [owner, repo] = repository.split('/');
  if (!owner || !repo) {
    throw new Error(`Invalid repository full name: ${repository}`);
  }
  return [owner, repo];
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

function requiredString(value: unknown, name: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

function requiredNumber(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

function sanitizeError(error: unknown, token: string): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replaceAll(token, '[redacted-token]');
}

import { defaultRepositoryPolicy, RepositoryPolicy } from './config.js';
import { parseDevLoopCommand } from './command-parser.js';
import { JobRecord, JobStore } from './job-store.js';
import { assertSupportedGitHubEvent } from './webhook.js';
import { isAllowedActor } from '../security/repository-policy.js';

export type EventRouteResult =
  | { action: 'queued'; job: JobRecord; created: true; command?: string }
  | { action: 'duplicate'; job: JobRecord; created: false; command?: string }
  | { action: 'skipped'; reason: string }
  | { action: 'refused'; reason: string; command?: string };

export interface RouteGitHubEventInput {
  eventName: string;
  deliveryId: string;
  payload: unknown;
  store: JobStore;
  policy?: RepositoryPolicy;
}

export async function routeGitHubEvent(input: RouteGitHubEventInput): Promise<EventRouteResult> {
  assertSupportedGitHubEvent(input.eventName);

  if (input.eventName === 'workflow_run') {
    return routeWorkflowRun(input.payload, input.store);
  }
  if (input.eventName === 'check_run') {
    return routeCheckRun(input.payload, input.store);
  }
  if (input.eventName === 'check_suite') {
    return routeCheckSuite(input.payload, input.store);
  }
  if (input.eventName === 'issue_comment' || input.eventName === 'pull_request_review_comment') {
    return routeCommentCommand(input.eventName, input.payload, input.store, input.policy ?? defaultRepositoryPolicy());
  }

  return { action: 'skipped', reason: `No route for event ${input.eventName}.` };
}

async function routeWorkflowRun(payload: unknown, store: JobStore): Promise<EventRouteResult> {
  const data = asRecord(payload);
  const workflowRun = asRecord(data.workflow_run);
  if (data.action !== 'completed' || workflowRun.conclusion !== 'failure') {
    return { action: 'skipped', reason: 'workflow_run was not a completed failure.' };
  }

  const repository = repositoryFullName(data);
  const runId = requiredNumber(workflowRun.id, 'workflow_run.id');
  const sha = requiredString(workflowRun.head_sha, 'workflow_run.head_sha');
  const queued = await store.createJobIfAbsent({
    idempotencyKey: `${repository}:workflow_run:${runId}:${sha}`,
    repository,
    installationId: installationId(data),
    eventType: 'workflow_run.completed',
    triggerSha: sha,
    branch: optionalString(workflowRun.head_branch),
    status: 'queued'
  });

  return queued.created
    ? { action: 'queued', job: queued.job, created: true }
    : { action: 'duplicate', job: queued.job, created: false };
}

async function routeCheckRun(payload: unknown, store: JobStore): Promise<EventRouteResult> {
  const data = asRecord(payload);
  const checkRun = asRecord(data.check_run);
  if (data.action !== 'completed' || checkRun.conclusion !== 'failure') {
    return { action: 'skipped', reason: 'check_run was not a completed failure.' };
  }

  const repository = repositoryFullName(data);
  const checkRunId = requiredNumber(checkRun.id, 'check_run.id');
  const sha = requiredString(checkRun.head_sha, 'check_run.head_sha');
  const queued = await store.createJobIfAbsent({
    idempotencyKey: `${repository}:check_run:${checkRunId}:${sha}`,
    repository,
    installationId: installationId(data),
    eventType: 'check_run.completed',
    triggerSha: sha,
    status: 'queued'
  });

  return queued.created
    ? { action: 'queued', job: queued.job, created: true }
    : { action: 'duplicate', job: queued.job, created: false };
}

async function routeCheckSuite(payload: unknown, store: JobStore): Promise<EventRouteResult> {
  const data = asRecord(payload);
  const suite = asRecord(data.check_suite);
  if (data.action !== 'completed' || suite.conclusion !== 'failure') {
    return { action: 'skipped', reason: 'check_suite was not a completed failure.' };
  }

  const repository = repositoryFullName(data);
  const suiteId = requiredNumber(suite.id, 'check_suite.id');
  const sha = requiredString(suite.head_sha, 'check_suite.head_sha');
  const queued = await store.createJobIfAbsent({
    idempotencyKey: `${repository}:check_suite:${suiteId}:${sha}`,
    repository,
    installationId: installationId(data),
    eventType: 'check_suite.completed',
    triggerSha: sha,
    status: 'queued'
  });

  return queued.created
    ? { action: 'queued', job: queued.job, created: true }
    : { action: 'duplicate', job: queued.job, created: false };
}

async function routeCommentCommand(
  eventName: string,
  payload: unknown,
  store: JobStore,
  policy: RepositoryPolicy
): Promise<EventRouteResult> {
  const data = asRecord(payload);
  if (data.action !== 'created') {
    return { action: 'skipped', reason: 'comment event was not created.' };
  }

  const comment = asRecord(data.comment);
  const parsed = parseDevLoopCommand(requiredString(comment.body, 'comment.body'));
  if (!parsed.isCommand) {
    return { action: 'skipped', reason: 'comment did not contain a DevLoop command.' };
  }
  if (!parsed.knownCommand) {
    return { action: 'skipped', reason: `unknown DevLoop command: ${parsed.args[0] ?? ''}` };
  }
  if (!policy.comments.enabled || !policy.comments.commands.includes(parsed.command)) {
    return { action: 'skipped', reason: `DevLoop command is disabled: ${parsed.command}` };
  }
  if (
    !isAllowedActor({
      login: optionalString(asRecord(comment.user).login),
      association: optionalString(comment.author_association),
      policy
    })
  ) {
    return { action: 'refused', reason: 'Only repository collaborators or maintainers may run DevLoop.', command: parsed.command };
  }

  const repository = repositoryFullName(data);
  const commentId = requiredNumber(comment.id, 'comment.id');
  const issue = asRecord(data.issue);
  const pullRequest = asRecord(data.pull_request);
  const pullRequestHead = asRecord(pullRequest.head);
  const targetNumber = optionalNumber(issue.number) ?? optionalNumber(pullRequest.number) ?? commentId;
  const queued = await store.createJobIfAbsent({
    idempotencyKey: `${repository}:${eventName}:${commentId}:${parsed.command}`,
    repository,
    installationId: installationId(data),
    eventType: `${eventName}.created`,
    triggerSha: optionalString(pullRequestHead.sha) ?? 'comment',
    branch: `devloop/comment-${targetNumber}`,
    status: 'queued',
    patchSummary: `command:${parsed.command}`
  });

  return queued.created
    ? { action: 'queued', job: queued.job, created: true, command: parsed.command }
    : { action: 'duplicate', job: queued.job, created: false, command: parsed.command };
}

function repositoryFullName(payload: Record<string, unknown>): string {
  return requiredString(asRecord(payload.repository).full_name, 'repository.full_name');
}

function installationId(payload: Record<string, unknown>): number {
  return requiredNumber(asRecord(payload.installation).id, 'installation.id');
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

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function requiredNumber(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

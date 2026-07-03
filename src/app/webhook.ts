export const SUPPORTED_GITHUB_EVENTS = new Set([
  'workflow_run',
  'check_suite',
  'check_run',
  'issue_comment',
  'pull_request_review_comment'
]);

export function assertSupportedGitHubEvent(eventName: string): void {
  if (!SUPPORTED_GITHUB_EVENTS.has(eventName)) {
    throw new Error(`Unsupported GitHub event: ${eventName}`);
  }
}

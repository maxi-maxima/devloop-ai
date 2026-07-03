export const REQUIRED_GITHUB_APP_PERMISSIONS = {
  actions: 'read',
  checks: 'read',
  contents: 'write',
  issues: 'write',
  metadata: 'read',
  pullRequests: 'write'
} as const;

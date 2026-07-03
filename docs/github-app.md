# GitHub App Mode

DevLoop V2 can run as a GitHub App webhook service:

```bash
devloop app serve
```

The server exposes:

- `GET /healthz`
- `POST /webhooks/github`

## Required GitHub App Settings

Create a GitHub App and configure its webhook URL:

```text
https://your-devloop-host.example.com/webhooks/github
```

Subscribe to these events:

- `workflow_run`
- `check_suite`
- `check_run`
- `issue_comment`
- `pull_request_review_comment`

Recommended permissions:

- Actions: read
- Checks: read
- Contents: write
- Issues: write
- Metadata: read
- Pull requests: write

## Environment

```env
GITHUB_APP_ID=
GITHUB_APP_PRIVATE_KEY=
GITHUB_WEBHOOK_SECRET=
GITHUB_APP_CLIENT_ID=
GITHUB_APP_CLIENT_SECRET=
DEVLOOP_APP_BASE_URL=https://your-devloop-host.example.com
DEVLOOP_APP_PORT=8787
DEVLOOP_APP_DB=.devloop/devloop-app.sqlite
```

`GITHUB_APP_PRIVATE_KEY` may contain escaped newlines (`\n`). DevLoop normalizes them before signing the GitHub App JWT.

## Repository Policy

Add `.devloop.yml` to a repository:

```yaml
enabled: true
autofix:
  enabled: true
  mode: "dry-run"
  maxRetries: 3
  testCommand: "npm test"
  installCommand: "npm install"
  allowedBranches:
    - main
    - master
  ignoredWorkflows:
    - release.yml
  maxFilesChanged: 5
  allowLockfileEdits: false
  allowNetwork: false

security:
  enabled: true
  sarifPaths:
    - results.sarif

comments:
  enabled: true
  allowedUsers:
    - maintainers
  commands:
    - diagnose
    - fix
    - dry-run
    - security-fix
    - rerun
```

If `.devloop.yml` is missing, DevLoop defaults to dry-run mode. It will diagnose failures and queue jobs, but it will not push branches or open pull requests until PR mode is enabled.

## Comment Commands

Supported commands:

```text
/devloop help
/devloop diagnose
/devloop dry-run
/devloop fix
/devloop security-fix
/devloop rerun
```

By default, only repository owners, members, and collaborators can trigger DevLoop commands.

## Safety Notes

- Webhooks are verified with `X-Hub-Signature-256`.
- Duplicate `X-GitHub-Delivery` IDs are ignored.
- Workflow/check/comment jobs use idempotency keys to avoid duplicate runs.
- Installation tokens are cached until near expiration.
- Private keys and tokens are redacted from config serialization and are not written to job logs.
- PR mode never auto-merges.

## Local Development

```bash
npm install
npm run build
cp .env.example .env
devloop app serve --port 8787
```

For local tunnel testing, point the GitHub App webhook URL to your tunnel's `/webhooks/github` path.

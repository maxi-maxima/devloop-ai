# Self-Hosting

DevLoop is designed to run under your control.

## Requirements

- Node.js 20 or newer,
- a GitHub App with webhook access,
- a reachable HTTPS endpoint for GitHub webhooks,
- repository permissions for Actions, Checks, Contents, Issues, Metadata, and Pull requests.

## Install

```bash
git clone <repo>
cd devloop-ai
npm install
npm run build
cp .env.example .env
```

Set:

```env
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4.1-mini
GITHUB_APP_ID=
GITHUB_APP_PRIVATE_KEY=
GITHUB_WEBHOOK_SECRET=
DEVLOOP_APP_BASE_URL=https://your-devloop-host.example.com
DEVLOOP_APP_PORT=8787
DEVLOOP_APP_DB=.devloop/devloop-app.sqlite
```

Start:

```bash
devloop app serve
```

## Repository Policy

Add `.devloop.yml` to each repository:

```yaml
enabled: true
autofix:
  enabled: true
  mode: "dry-run"
  maxRetries: 3
  testCommand: "npm test"
  allowLockfileEdits: false
  allowNetwork: false

security:
  enabled: true
  sarifPaths:
    - results.sarif

comments:
  enabled: true
  commands:
    - diagnose
    - dry-run
    - fix
    - security-fix
```

## Operations

- Run behind HTTPS.
- Rotate app private keys and webhook secrets regularly.
- Keep the queue database backed up if you need audit history.
- Start in dry-run mode.
- Promote to PR mode repository by repository.
- Watch failed jobs, unsafe patch rejections, and test failures.

## Rollback

Rollback is straightforward:

1. disable the GitHub App installation or remove webhook delivery,
2. set `.devloop.yml` `autofix.mode` back to `dry-run`,
3. stop the DevLoop service,
4. close any unmerged DevLoop PRs if needed.

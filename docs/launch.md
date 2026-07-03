# Launch Guide

This guide keeps the public launch focused on one promise:

DevLoop AI turns failed CI and security alerts into tested pull requests while keeping maintainers in control.

## Audience

- maintainers who spend time triaging failed CI,
- developers who want a repeatable autofix loop,
- security teams that want safe SARIF remediation,
- AI tooling users who want self-hosted automation instead of copy-paste chats.

## Launch Checklist

- README explains the product in the first 10 seconds.
- `./scripts/demo-autofix.sh` works from a fresh clone.
- GitHub App, GitHub Action, CLI, Codex Skill, Security Autofix, and MCP-ready tool paths are documented.
- FixBench results are visible.
- Safety posture is obvious: no auto-merge, dry runs, patch validation, human review.
- Issue templates and PR template are present.
- `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, and `ROADMAP.md` exist.

## Demo Flow

```bash
git clone https://github.com/maxi-maxima/devloop-ai.git
cd devloop-ai
npm install
npm run build
./scripts/demo-autofix.sh
```

The demo should show:

1. a failing test,
2. DevLoop diagnosis,
3. dry-run patch preview,
4. applied fix,
5. passing tests,
6. final git diff.

## Launch Messaging

Short:

```text
CI failed? DevLoop reads the logs, patches the bug, reruns tests, and opens a PR.
```

Long:

```text
DevLoop AI is an open-source GitHub App that turns failed CI and security alerts into tested pull requests. It is self-hostable, conservative by default, and built around minimal patches plus human review.
```

## Release Notes Outline

- What DevLoop does
- 30-second demo
- GitHub App and GitHub Action setup
- Security Autofix from SARIF
- FixBench baseline
- Safety model
- How to contribute failing CI cases

## Post-Launch Signals

Track:

- demo completion issues,
- first external failed-CI fixture contributions,
- GitHub App setup friction,
- false unsafe rejections,
- cases where DevLoop should return `DEVLOOP_CANNOT_FIX_SAFELY`,
- FixBench regressions.

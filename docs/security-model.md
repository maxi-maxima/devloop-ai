# Security Model

DevLoop is designed for conservative automation. It can propose and validate patches, but it should not become an unreviewed merge bot.

## Core Principles

- Humans merge PRs.
- Dry-run first for risky or remote-triggered workflows.
- Patches must be valid unified diffs.
- Test commands run through the configured runner boundary.
- Secrets are not needed for test processes.
- Security fixes should address root causes, not silence scanners.

## Forbidden Files and Changes

DevLoop rejects or blocks:

- `.env` files and secret files,
- private keys and certificate material,
- binary patches,
- lockfile edits unless explicitly allowed,
- GitHub workflow permission changes unless explicitly allowed,
- patches that touch too many files,
- malformed diffs.

Security Autofix adds extra rejection rules for:

- scanner suppression comments,
- ignore comments as the primary fix,
- deleted tests,
- weakened validation,
- disabled authentication or authorization,
- hardcoded credentials,
- secret logging,
- broad refactors.

## Pull Request Safety

DevLoop PR bodies include:

- root cause,
- patch summary,
- files changed,
- tests run,
- validation result,
- safety notes,
- metadata about provider/model/attempts where available.

The PR body should make it easy for a maintainer to decide whether to accept, edit, or reject the patch.

## Runner Safety

The runner boundary is intentionally explicit:

- do not pass secrets to tests unless the repository owner opts in,
- prefer deterministic local or sandboxed commands,
- disable network unless a workflow explicitly needs it,
- keep retry limits small,
- preserve logs needed for audit.

## Security Disclosure

Report security issues through [SECURITY.md](../SECURITY.md). Do not open public issues for vulnerabilities that could affect users.

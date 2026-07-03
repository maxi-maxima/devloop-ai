---
name: devloop-autofix
description: Use this skill when a repository has failing CI, failing tests, or a broken build and the user wants a minimal safe patch plus validation.
---

# DevLoop AutoFix

Use DevLoop to turn failing CI logs into a minimal patch that is validated by the repository test command.

## Workflow

1. Inspect failing logs first.
2. Run `devloop diagnose --repo <repo> --log-file <log>`.
3. Build confidence in the root cause before changing files.
4. Run `devloop autofix --repo <repo> --log-file <log> --test-command "<cmd>" --dry-run --no-pr`.
5. Review the patch preview and safety result.
6. Run `devloop autofix` without `--dry-run` only after the preview is safe.
7. Run the test command again before claiming success.
8. Summarize test command, files changed, and risk level.

Shortest safe preview command: `devloop autofix --dry-run`.

## Rules

- Prefer minimal patches.
- Never edit secrets, `.env` files, private keys, or credentials.
- Never disable tests, linting, type checks, or security checks to make CI pass.
- Never broaden scope into unrelated refactors.
- Read `references/safety.md` when a patch touches config, CI, auth, dependencies, or generated files.
- Read `references/examples.md` when you need user-facing prompt examples.

## Helper Script

Use `scripts/run-devloop-autofix.sh` for safe defaults. Required environment:

```bash
LOG_FILE=ci.log TEST_COMMAND="npm test" REPO_PATH=. .agents/skills/devloop-autofix/scripts/run-devloop-autofix.sh
```

Set `APPLY=1` only after reviewing the dry-run result.

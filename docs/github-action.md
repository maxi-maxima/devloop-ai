# DevLoop GitHub Action

Use DevLoop as a CI autofix agent when a workflow fails.

## Required Secrets

- `OPENAI_API_KEY`: used to diagnose logs and generate a minimal patch.
- `GITHUB_TOKEN`: automatically provided by GitHub Actions. The workflow grants `contents: write`, `pull-requests: write`, and `actions: read`.

## Setup

1. Copy `templates/github-actions/devloop-autofix.yml` to `.github/workflows/devloop-autofix.yml`.
2. Change the `workflows: ["CI"]` value to match your main CI workflow name.
3. Set `OPENAI_API_KEY` in repository secrets.
4. Update the test command if your repository does not use `npm test`.

## Behavior

When the configured CI workflow completes with `failure`, DevLoop:

1. downloads failed workflow logs,
2. diagnoses the likely root cause,
3. builds a focused file context,
4. asks the configured model for a unified diff patch,
5. validates the patch against safety rules,
6. applies it,
7. reruns the test command,
8. opens a pull request if tests pass.

## Safety

DevLoop rejects patches that touch secrets, `.env` files, private keys, binary files, too many files, or lockfiles unless explicitly allowed. It also blocks GitHub workflow permission changes unless allowed.

## Limitations

- V1 focuses on Node.js and Python-style source layouts.
- The model must return unified diff output.
- PR creation requires push permission.
- Broad refactors and ambiguous failures should be reviewed by a human.

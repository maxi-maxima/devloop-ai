# Self-Dogfooding

DevLoop includes a controlled self-dogfood fixture that proves the CI autofix loop can repair a failing test inside this repository without touching production code.

The fixture lives in `fixtures/self-dogfood/`. On `main`, it passes. The dogfood scripts create a branch that changes one safe fallback line in `src/user.js` so `npm test` fails with a realistic null/undefined handling bug.

## Local Repro

```bash
./scripts/self-dogfood/local.sh
```

The local script:

1. copies the current repository into an isolated temp directory,
2. introduces the controlled fixture bug,
3. runs the fixture test and captures the failure log,
4. runs `devloop autofix --dry-run --demo --no-pr`,
5. runs `devloop autofix --demo --no-pr`,
6. reruns the fixture test,
7. prints the final `git diff`.

Set `DEVLOOP_SELF_DOGFOOD_KEEP=1` to keep the temp directory for inspection.

## Create the Failing Branch

```bash
./scripts/self-dogfood/start.sh
```

The start script requires a clean `main` branch, creates `dogfood/failing-ci`, introduces the fixture bug, commits it, pushes the branch, and prints the next steps.

Clean up local state with:

```bash
./scripts/self-dogfood/reset.sh
```

Use `--delete-remote` only when you also want to remove the pushed dogfood branch.

## Path A: DevLoop GitHub App

1. Run `./scripts/self-dogfood/start.sh`.
2. Open a pull request from `dogfood/failing-ci` into `main`.
3. Wait for the `Self Dogfood Fixture` workflow to fail.
4. Trigger the GitHub App with PR comments:

```text
/devloop dry-run
/devloop fix
```

Expected result: DevLoop diagnoses the fixture failure, previews a minimal patch, applies the safe one-line fix, reruns `npm test` in the fixture sandbox, and reports the evidence bundle.

The PR output should include:

- diagnosis,
- patch summary,
- test result,
- sandbox info,
- firewall report,
- evidence bundle summary.

## Path B: DevLoop GitHub Action

The repository includes a minimal manual workflow for private alpha validation:

```text
.github/workflows/self-dogfood-devloop.yml
```

This workflow is intentionally `workflow_dispatch` only. It checks out the controlled failing branch, captures the fixture test failure, runs DevLoop in dry-run mode, applies the safe fixture patch when requested, reruns tests, verifies the patch only touches `fixtures/self-dogfood/src/user.js`, and opens a reviewable pull request back into the dogfood branch.

### Required GitHub Secrets

The default self-dogfood workflow uses DevLoop's deterministic `--demo` path and requires no model provider secrets.

Required configuration:

- `GITHUB_TOKEN`: provided automatically by GitHub Actions.

Optional provider secrets for adapting this workflow to non-demo LLM mode:

- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`

Do not print provider keys in logs, commit them to the repository, or pass them to the fixture test process. If you adapt the workflow away from `--demo`, pass provider secrets only to the DevLoop step that needs them.

### Run the Workflow

First make sure the controlled failing branch exists:

```bash
./scripts/self-dogfood/start.sh
```

Then trigger the workflow from the GitHub UI:

1. Open **Actions**.
2. Select **Self Dogfood DevLoop**.
3. Choose **Run workflow** on `main`.
4. Set `target_branch` to `dogfood/failing-ci`.
5. Set `test_command` to `npm test`.
6. Set `dry_run` to `false` to allow PR creation.

Or trigger it with GitHub CLI:

```bash
gh workflow run self-dogfood-devloop.yml \
  --ref main \
  -f target_branch=dogfood/failing-ci \
  -f test_command="npm test" \
  -f dry_run=false
```

For a preview-only run that cannot open a PR:

```bash
gh workflow run self-dogfood-devloop.yml \
  --ref main \
  -f target_branch=dogfood/failing-ci \
  -f test_command="npm test" \
  -f dry_run=true
```

### Identify the Generated PR

The workflow creates a branch named like:

```text
devloop/self-dogfood-fix-<run-id>-<attempt>
```

The pull request title is:

```text
DevLoop self-fix: repair self-dogfood fixture
```

Find it with:

```bash
gh pr list --state open --search "DevLoop self-fix: repair self-dogfood fixture in:title"
```

The PR body includes diagnosis, patch summary, test result, runner/sandbox details, patch scope validation, and the workflow run URL.

## Safety Notes

- The controlled bug is limited to `fixtures/self-dogfood/src/user.js`.
- No secrets or private data are required.
- The local demo clears common AI and GitHub token environment variables before running the deterministic demo provider.
- The fixture test workflow has read-only repository permissions.
- The self-dogfood PR workflow has only the permissions needed to push a fix branch and open a PR.
- The workflow proves the loop through a reviewable PR; it does not auto-merge.

## Cleanup

Close or merge the generated self-fix PR after review. Delete temporary fix branches with:

```bash
git push origin --delete devloop/self-dogfood-fix-<run-id>-<attempt>
```

Clean up the dogfood branch when the validation is done:

```bash
./scripts/self-dogfood/reset.sh --delete-remote
```

After the first real self-fix PR exists, update the README placeholder:

```text
Real self-fix PR:
https://github.com/<owner>/devloop-ai/pull/<number>
```

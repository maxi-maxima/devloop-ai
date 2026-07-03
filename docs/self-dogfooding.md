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

1. Add or enable the DevLoop autofix action from `templates/github-actions/devloop-autofix.yml`.
2. Configure it to watch the `Self Dogfood Fixture` workflow.
3. Configure the autofix command with `--repo fixtures/self-dogfood --test-command "npm test"`.
4. Store the provider API key as a GitHub secret, or use a self-hosted provider.
5. Run `./scripts/self-dogfood/start.sh`.
6. Open the dogfood PR and let the failing workflow trigger the autofix action.

The action should open a DevLoop-generated PR or push a fix according to your configured mode. It should still include diagnosis, validation command, sandbox metadata, firewall report, and evidence bundle details.

## Safety Notes

- The controlled bug is limited to `fixtures/self-dogfood/src/user.js`.
- No secrets or private data are required.
- The local demo clears common AI and GitHub token environment variables before running the deterministic demo provider.
- The dogfood workflow has read-only repository permissions.
- The workflow proves the loop through a reviewable PR; it does not auto-merge.

After the first real self-fix PR exists, update the README placeholder:

```text
Real self-fix PR:
https://github.com/<owner>/devloop-ai/pull/<number>
```
